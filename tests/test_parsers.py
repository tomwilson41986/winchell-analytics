"""Parser tests against representative markup for each source.

These exercise parsing logic with small constructed snippets shaped like the
live pages each scraper was written against; they assert structure, never
fabricate source facts.
"""

from datetime import date

from selectolax.parser import HTMLParser

from scrapers.horse_scrapers import (
    HRNScraper,
    PedigreeScraper,
    ResultsScraper,
    SalesScraper,
    _grade_from_text,
    _parse_furlongs,
    extract_labelled_table,
)
from scrapers.owner_discovery import _entries_from_horse_links
from scrapers.wiki import WikiScraper, _parse_earnings, _parse_record, _parse_year


# --- small helpers --------------------------------------------------------- #


def test_parse_furlongs_forms():
    assert _parse_furlongs("6 Furlongs") == 6.0
    assert _parse_furlongs("1 1/16 Miles") == 8.5
    assert _parse_furlongs("1 1/4 Miles") == 10.0
    assert _parse_furlongs("7f") == 7.0
    assert _parse_furlongs("nonsense") is None


def test_grade_detection():
    assert _grade_from_text("Breeders' Cup Classic (G1)") == "G1"
    assert _grade_from_text("Some Listed Stakes") == "Listed"
    assert _grade_from_text("Maiden Special Weight") is None


# --- Equibase-style results (header-driven) -------------------------------- #

RESULTS_HTML = """
<table>
<tr><th>Date</th><th>Track</th><th>Race</th><th>Dist</th><th>Surface</th>
    <th>FinPos</th><th>Field</th><th>Jockey</th><th>Speed</th><th>Earnings</th></tr>
<tr><td>09/30/2017</td><td>CD</td><td>Test Handicap (G2)</td><td>1 1/8 Miles</td>
    <td>Dirt</td><td>1</td><td>8</td><td>J Smith</td><td>112</td><td>$300,000</td></tr>
</table>
"""


def test_results_parser_maps_columns_by_header():
    rows = extract_labelled_table(HTMLParser(RESULTS_HTML), {"date", "track", "finish"})
    assert rows and len(rows) == 1
    res = ResultsScraper.parse_results(HTMLParser(RESULTS_HTML))
    r = res[0]
    assert r.race_date == date(2017, 9, 30)
    assert r.grade == "G2"
    assert r.distance_furlongs == 9.0
    assert r.finish_position == 1 and r.field_size == 8
    assert r.speed_figure == 112 and r.earnings == 300_000


# --- Sales (RNA + name filter) --------------------------------------------- #

SALES_HTML = """
<table>
<tr><th>Hip</th><th>Name</th><th>Consignor</th><th>Price</th><th>Buyer</th></tr>
<tr><td>120</td><td>Epicenter</td><td>Farm A</td><td>$260,000</td><td>Winchell</td></tr>
<tr><td>77</td><td>Other</td><td>Farm B</td><td>RNA</td><td>-</td></tr>
</table>
"""


def test_sales_parser_filters_and_flags_rna():
    sold = SalesScraper.parse_sales(HTMLParser(SALES_HTML), name="Epicenter", house="Keeneland")
    assert len(sold) == 1
    assert sold[0].price == 260_000 and sold[0].rfna is False
    rna = SalesScraper.parse_sales(HTMLParser(SALES_HTML), name="Other", house="Keeneland")
    assert rna[0].rfna is True and rna[0].price is None


# --- Horse Racing Nation ---------------------------------------------------- #

HRN_HTML = """
<html><body>
<dl>
  <dt>Age:</dt><dd>9 years old - Horse</dd>
  <dt>Status:</dt><dd>Active</dd>
  <dt>Pedigree:</dt><dd>Candy Ride - Quiet Giant by Giant's Causeway</dd>
  <dt>Owner(s):</dt><dd>Winchell Thoroughbreds LLC</dd>
  <dt>Trainer:</dt><dd>Steven M. Asmussen</dd>
</dl>
<table class="horse-table">
<tr><td>Caption row</td></tr>
<tr><th>Date</th><th>Finish (speed)</th><th>Trk</th><th>Distance</th><th>Surface</th>
    <th>Race</th><th>1st</th><th>2nd</th><th>3rd</th><th>Time</th></tr>
<tr><td>11/4/17</td><td>1st (146)</td><td>DMR</td><td>1 1/4 m</td><td>Dirt</td>
    <td>2017 Test Cup (G1)</td><td>A</td><td>B</td><td>C</td><td>2:01.29</td></tr>
</table></body></html>
"""


def test_hrn_connections():
    conn = HRNScraper._connections(HTMLParser(HRN_HTML))
    assert conn.status == "Active"
    assert conn.sex == "Horse"
    assert conn.owner == "Winchell Thoroughbreds LLC"
    assert conn.trainer == "Steven M. Asmussen"
    assert conn.sire == "Candy Ride" and conn.damsire == "Giant's Causeway"


def test_hrn_results():
    res = HRNScraper.parse_results(HTMLParser(HRN_HTML))
    assert len(res) == 1
    r = res[0]
    assert r.race_date == date(2017, 11, 4)
    assert r.finish_position == 1 and r.speed_figure == 146
    assert r.grade == "G1" and r.distance_furlongs == 10.0


# --- pedigreequery --------------------------------------------------------- #

PED_CELLS = [
    (1, "SIRE"),
    (2, "SIRE SIRE"),
    (3, "COMMON"),
    (3, "SS DAM"),
    (2, "SIRE DAM"),
    (3, "SD SIRE"),
    (3, "SD DAM"),
    (1, "DAM"),
    (2, "DAMSIRE"),
    (3, "COMMON"),  # duplicated ancestor -> inbreeding
    (3, "DS DAM"),
    (2, "DAM DAM"),
    (3, "DD SIRE"),
    (3, "DD DAM"),
]
PED_HTML = (
    '<table class="pedigreetable">'
    + "".join(
        f'<tr><td data-g="{g}"><a class="horseName">{n}</a> (USA)<br> b. 2000</td></tr>'
        for g, n in PED_CELLS
    )
    + "</table>"
)


def test_pedigree_positions_and_inbreeding():
    ped = PedigreeScraper(client=None)._parse_tree(HTMLParser(PED_HTML))
    assert ped.sire.name == "SIRE"
    assert ped.dam.name == "DAM"
    assert ped.damsire.name == "DAMSIRE"
    assert ped.extended["sire_sire"].name == "SIRE SIRE"
    # "COMMON" appears at gen 3 on both sides -> inbreeding 3x3.
    assert any(s.startswith("Common 3x3") for s in ped.inbreeding)


# --- Wikipedia ------------------------------------------------------------- #


def test_wiki_record_earnings_year():
    assert _parse_record("19: 12-3-2") == (19, 12, 3, 2)
    assert _parse_record("19: 12–3–2") == (19, 12, 3, 2)  # en-dashes
    assert _parse_earnings("US$15,988,500[1]") == 15_988_500
    assert _parse_year("(2013-03-08)March 8, 2013(age 13)") == 2013


WIKI_HTML = """
<html><body>
<table class="infobox">
<tr><th>Sire</th><td>Candy Ride</td></tr>
<tr><th>Owner</th><td>Winchell Thoroughbreds LLC and Three Chimneys Farm</td></tr>
<tr><th>Record</th><td>19: 12-3-2</td></tr>
<tr><th>Earnings</th><td>US$15,988,500[1]</td></tr>
<tr><th>Major wins</th></tr>
<tr><td><a>Test Cup</a> <a>2017</a> <a>Other Stakes</a></td></tr>
</table>
<a href="...refno=9496167...">cite</a>
</body></html>
"""


def test_wiki_parse():
    tree = HTMLParser(WIKI_HTML)
    box = tree.css_first("table.infobox")
    enr = WikiScraper(client=None)._parse("Gun Runner (horse)", "u", box, WIKI_HTML)
    assert enr.owner_is_winchell
    assert enr.form.starts == 19 and enr.form.total_earnings == 15_988_500
    assert enr.equibase_refno == "9496167"
    assert "Test Cup" in enr.major_wins and "2017" not in enr.major_wins


# --- owner-page discovery -------------------------------------------------- #

OWNER_HTML = """
<table>
<tr><td><a href="Results.cfm?type=Horse&refno=111&registry=T">First Mission</a></td></tr>
<tr><td><a href="Results.cfm?type=People&searchType=T&eID=9">Asmussen, Steven</a></td></tr>
</table>
"""


def test_owner_page_extracts_horses_only():
    entries = _entries_from_horse_links(HTMLParser(OWNER_HTML), via="owner_page")
    assert [e.name for e in entries] == ["First Mission"]
    assert entries[0].equibase_refno == "111"
