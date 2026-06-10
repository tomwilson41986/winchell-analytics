"""Shared HTTP layer for all scrapers.

Responsibilities:

* One polite ``httpx`` client with a project-identifying User-Agent.
* Per-host rate limiting honouring each source's ``rate_limit_seconds``.
* robots.txt fetched once per host and obeyed (Protego); blocked URLs raise.
* Bounded retries with exponential backoff on transient network/5xx errors.
* Raw-response disk cache keyed by a hash of the URL, so re-runs do not
  re-hit sources and we keep provenance of exactly what was parsed.

Parsers elsewhere call :func:`get_html` and receive a parsed selectolax tree;
the raw bytes are persisted under ``data/cache/`` alongside a small metadata
sidecar (URL, fetch time, status).
"""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import httpx
from protego import Protego
from selectolax.parser import HTMLParser

from .config import USER_AGENT

CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / "cache"
DEFAULT_RATE_LIMIT = 5.0
MAX_RETRIES = 4
BACKOFF_BASE = 2.0  # seconds: 2, 4, 8, 16


class RobotsDisallowed(RuntimeError):
    """Raised when robots.txt forbids fetching a URL."""


# Markers of a bot-protection challenge / interstitial rather than real content.
# When a 200 body matches one of these we treat it as a failed fetch: we do not
# parse it and do not cache it, so the pipeline degrades to "no data found"
# rather than ingesting a challenge page.
_BLOCK_MARKERS = (
    "incapsula",
    "imperva",
    "_incapsula_resource",
    "px-captcha",
    "request unsuccessful",
    "/cdn-cgi/challenge-platform/",
    "attention required! | cloudflare",
)


def looks_blocked(body: str) -> bool:
    """Heuristic: does this 200 response look like a bot-block / challenge?"""
    head = body[:4000].lower()
    return any(marker in head for marker in _BLOCK_MARKERS)


class HttpClient:
    """A rate-limited, robots-aware, caching HTTP client.

    One instance is shared across scrapers within a run. State (last-fetch
    times per host, robots parsers, robots fetch failures) lives on the
    instance so politeness is enforced globally.
    """

    def __init__(
        self,
        *,
        rate_limit_seconds: float = DEFAULT_RATE_LIMIT,
        host_rate_limits: Optional[dict[str, float]] = None,
        cache_dir: Path = CACHE_DIR,
        respect_robots: bool = True,
        offline: bool = False,
    ) -> None:
        self.rate_limit_seconds = rate_limit_seconds
        # Per-host overrides (netloc -> seconds) so each source honours its own
        # published crawl-delay regardless of the shared default.
        self.host_rate_limits = host_rate_limits or {}
        self.cache_dir = cache_dir
        self.respect_robots = respect_robots
        # offline mode: only ever read from cache, never touch the network.
        self.offline = offline
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        self._client = httpx.Client(
            headers={"User-Agent": USER_AGENT},
            follow_redirects=True,
            timeout=httpx.Timeout(30.0),
            http2=False,
        )
        self._last_fetch: dict[str, float] = {}
        self._robots: dict[str, Optional[Protego]] = {}

    # ----------------------------------------------------------------- #
    # Cache helpers
    # ----------------------------------------------------------------- #

    def _cache_paths(self, url: str) -> tuple[Path, Path]:
        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:24]
        host = urlparse(url).netloc.replace(":", "_")
        base = self.cache_dir / host
        base.mkdir(parents=True, exist_ok=True)
        return base / f"{digest}.html", base / f"{digest}.meta.json"

    def _read_cache(self, url: str) -> Optional[str]:
        body_path, _ = self._cache_paths(url)
        if body_path.exists():
            return body_path.read_text(encoding="utf-8", errors="replace")
        return None

    def _write_cache(self, url: str, body: str, status: int) -> None:
        body_path, meta_path = self._cache_paths(url)
        body_path.write_text(body, encoding="utf-8", errors="replace")
        meta_path.write_text(
            json.dumps(
                {"url": url, "status": status, "fetched_at": time.time()},
                indent=2,
            ),
            encoding="utf-8",
        )

    # ----------------------------------------------------------------- #
    # robots.txt
    # ----------------------------------------------------------------- #

    def _robots_for(self, url: str) -> Optional[Protego]:
        parsed = urlparse(url)
        host = f"{parsed.scheme}://{parsed.netloc}"
        if host in self._robots:
            return self._robots[host]
        parser: Optional[Protego] = None
        try:
            resp = self._client.get(f"{host}/robots.txt", timeout=15.0)
            if resp.status_code == 200 and resp.text.strip():
                parser = Protego.parse(resp.text)
        except httpx.HTTPError:
            parser = None  # absent/unreachable robots → treat as allowed
        self._robots[host] = parser
        return parser

    def _allowed(self, url: str) -> bool:
        if not self.respect_robots:
            return True
        parser = self._robots_for(url)
        if parser is None:
            return True
        return parser.can_fetch(url, USER_AGENT)

    # ----------------------------------------------------------------- #
    # Rate limiting
    # ----------------------------------------------------------------- #

    def _throttle(self, url: str) -> None:
        host = urlparse(url).netloc
        limit = self.host_rate_limits.get(host, self.rate_limit_seconds)
        last = self._last_fetch.get(host)
        if last is not None:
            elapsed = time.monotonic() - last
            wait = limit - elapsed
            if wait > 0:
                time.sleep(wait)
        self._last_fetch[host] = time.monotonic()

    # ----------------------------------------------------------------- #
    # Fetch
    # ----------------------------------------------------------------- #

    def get(self, url: str, *, use_cache: bool = True) -> Optional[str]:
        """Fetch ``url`` as text, via cache when available.

        Returns the response body, or ``None`` when the URL could not be
        retrieved (and was not cached). Raises :class:`RobotsDisallowed` when
        robots.txt forbids the URL.
        """
        if use_cache:
            cached = self._read_cache(url)
            if cached is not None:
                return cached

        if self.offline:
            return None  # cache miss and we are not allowed to go online

        if not self._allowed(url):
            raise RobotsDisallowed(f"robots.txt disallows: {url}")

        last_err: Optional[Exception] = None
        for attempt in range(MAX_RETRIES):
            self._throttle(url)
            try:
                resp = self._client.get(url)
            except httpx.HTTPError as exc:  # network/timeout
                last_err = exc
            else:
                if resp.status_code == 200:
                    if looks_blocked(resp.text):
                        # Treat a challenge/interstitial as a soft failure: do
                        # not cache it, retry in case it clears, then give up.
                        last_err = RuntimeError(f"bot-protection challenge: {url}")
                    else:
                        self._write_cache(url, resp.text, resp.status_code)
                        return resp.text
                elif resp.status_code in (429, 500, 502, 503, 504):
                    last_err = httpx.HTTPStatusError(
                        f"status {resp.status_code}",
                        request=resp.request,
                        response=resp,
                    )
                else:
                    # 4xx (not found etc.): no point retrying.
                    return None
            time.sleep(BACKOFF_BASE * (2**attempt))
        if last_err is not None:
            # Surface as None so callers degrade gracefully; provenance is the
            # absence of a cache entry.
            return None
        return None

    def cache_put(self, url: str, body: str) -> Path:
        """Seed the cache with a body for ``url`` (e.g. a browser-saved page).

        Lets terms-clean, manually-fetched HTML flow through the normal parsing
        path: the next ``get(url)`` is a cache hit. Returns the body cache path.
        """
        self._write_cache(url, body, 200)
        return self._cache_paths(url)[0]

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "HttpClient":
        return self

    def __exit__(self, *exc) -> None:
        self.close()


def get_html(client: HttpClient, url: str, *, use_cache: bool = True) -> Optional[HTMLParser]:
    """Fetch ``url`` and return a parsed selectolax tree, or ``None``."""
    body = client.get(url, use_cache=use_cache)
    if body is None:
        return None
    return HTMLParser(body)
