"""Adapter parser tests against small constructed fixtures shaped like the
live pages/APIs (structure asserted, no source facts fabricated), plus the
orchestrator's per-source failure isolation."""

import html
import json
from datetime import date

from pipeline.livesales.base import expand_colour, expand_sex
from pipeline.livesales.models import RawSale
from pipeline.livesales.registry import Source
from pipeline.livesales.run import collect_raw_sales
from pipeline.livesales.sources import bbag, fasigtipton, gavelhouse, goffs, keeneland
from pipeline.livesales.sources import magicmillions, nzb, tattersalls
from pipeline.livesales.sources.common import harvest_sales, pick

REF = date(2026, 6, 12)


# --- Tattersalls sale cards --------------------------------------------------- //

TATTS_CALENDAR = """
<html><body>
<div class="sale-card sale-card--status-catalogue-available">
  <h3 class="sale-card__heading"><a href="/4DCGI/Sale/JUL26">July Sale</a></h3>
  <div class="sale-card__meta-item">
    <span class="sale-card__meta-item-text">8 - 10 July 2026</span>
  </div>
</div>
<div class="sale-card sale-card--status-entries-open">
  <h3 class="sale-card__heading"><a href="/4DCGI/Sale/OCT26B1">October Yearling Sale Book 1</a></h3>
  <div class="sale-card__meta-item">
    <span class="sale-card__meta-item-text">6 – 9 October 2026</span>
  </div>
</div>
</body></html>
"""


def test_tattersalls_calendar_parse():
    sales = tattersalls.parse_sale_cards(
        TATTS_CALENDAR, "Tattersalls", "UK", "https://secure.tattersalls.com", REF
    )
    assert len(sales) == 2
    july = sales[0]
    assert july.name == "July Sale"
    assert (july.start_date, july.end_date) == (date(2026, 7, 8), date(2026, 7, 10))
    assert july.status_hint == "catalogue-available"
    assert july.catalogue_ref == "https://secure.tattersalls.com/4DCGI/Sale/JUL26"
    assert july.url == "https://secure.tattersalls.com/4DCGI/Sale/JUL26"
    assert sales[1].status_hint == "entries-open"


TATTS_LOTS = """
<table>
<tr>
  <td class="lot"><a class="ll" href="/lot/1">1</a></td>
  <td class="tdh"><a class="hn" href="/horse/1">EXAMPLE WALKER</a>
    2023 Ch.F.
    <span class="small">BY</span> Example Sire (GB)
    <span class="small">EX</span> Example Dam (IRE)
  </td>
  <td class="col2type">Filly</td>
  <td>Example Stud</td>
</tr>
<tr>
  <td class="lot"><a class="ll" href="/lot/2">2</a></td>
  <td class="tdh">
    2024 B.C.
    <span class="small">BY</span> Second Sire (USA)
    <span class="small">EX</span> Second Dam (GB)
  </td>
  <td class="col2type">Colt</td>
  <td>Second Consignor</td>
</tr>
</table>
"""


def test_tattersalls_lot_table_parse():
    lots = tattersalls.parse_lot_table(TATTS_LOTS)
    assert len(lots) == 2
    first = lots[0]
    assert first.lot_no == "1"
    assert first.horse_name == "EXAMPLE WALKER"
    assert (first.colour, first.sex) == ("Chestnut", "Filly")
    assert first.sire == "Example Sire (GB)"
    assert first.dam == "Example Dam (IRE)"
    assert first.vendor == "Example Stud"
    # Unnamed lot: name stays empty, never fabricated.
    second = lots[1]
    assert second.horse_name == ""
    assert (second.colour, second.sex) == ("Bay", "Colt")
    assert second.vendor == "Second Consignor"


# --- Generic HTML harvest (Goffs-style listing) -------------------------------- //

GOFFS_PAGE = """
<html><body>
<nav><a href="/">Home</a><a href="/upcoming-sales">Sales</a></nav>
<div class="sale-listing">
  <article class="sale-card">
    <h2><a href="/sales/orby-2026">Orby Yearling Sale</a></h2>
    <p>23 - 25 September 2026, Kildare Paddocks</p>
  </article>
  <article class="sale-card">
    <h2><a href="https://www.goffsuk.com/sales/premier">Goffs UK Premier Yearling Sale</a></h2>
    <p>25 - 26 August 2026, Doncaster</p>
  </article>
</div>
</body></html>
"""


def test_goffs_harvest_and_uk_arm_detection():
    sales = goffs.parse(GOFFS_PAGE, REF)
    assert len(sales) == 2
    orby = next(s for s in sales if "Orby" in s.name)
    assert (orby.house, orby.country) == ("Goffs", "IRE")
    assert orby.start_date == date(2026, 9, 23)
    assert orby.url == "https://www.goffs.com/sales/orby-2026"
    premier = next(s for s in sales if "Premier" in s.name)
    assert (premier.house, premier.country) == ("Goffs UK", "UK")


def test_harvest_skips_nav_and_undated_blocks():
    page = """
    <html><body>
    <li><a href="/news">News</a></li>
    <li><a href="/sales/no-date">Mystery Sale page with no date text</a></li>
    </body></html>
    """
    assert harvest_sales(
        page, house="X", country="UK", base_url="https://x.test/",
        ref=REF, source_key="x",
    ) == []


def test_harvest_rejects_date_only_names_and_editorial_cards():
    page = """
    <html><body>
    <article><h2><a href="/s/1">May 18-19</a></h2></article>
    <article><h2><a href="/s/3">nzb.co.nz</a></h2><p>25 June 2026</p></article>
    <div class="news-card"><h2><a href="/n/1">Filly Tops Online June Sale</a></h2>
      <p>5 June 2026</p></div>
    <article><h2><a href="/s/2">Winter Mixed Sale</a></h2><p>21 June 2026</p></article>
    </body></html>
    """
    sales = harvest_sales(
        page, house="X", country="UK", base_url="https://x.test/",
        ref=REF, source_key="x",
    )
    assert [s.name for s in sales] == ["Winter Mixed Sale"]


def test_harvest_prefers_date_elements_and_caps_runaway_ranges():
    # The card's own date element wins over unrelated dates in the body text.
    page = """
    <html><body>
    <article>
      <h2><a href="/s/1">September Yearling Sale</a></h2>
      <span class="event-date">14 - 16 September 2026</span>
      <p>Entries close 1 July 2026</p>
    </article>
    </body></html>
    """
    sales = harvest_sales(
        page, house="X", country="UK", base_url="https://x.test/",
        ref=REF, source_key="x",
    )
    assert (sales[0].start_date, sales[0].end_date) == (
        date(2026, 9, 14),
        date(2026, 9, 16),
    )

    # Without a date element, a "range" spanning months is mixed-in noise:
    # keep the start, drop the end.
    page = """
    <html><body>
    <article>
      <h2><a href="/s/2">Weanling Sale</a></h2>
      <p>5 May 2026. Next sale 6 March 2027.</p>
    </article>
    </body></html>
    """
    sales = harvest_sales(
        page, house="X", country="UK", base_url="https://x.test/",
        ref=REF, source_key="x",
    )
    assert (sales[0].start_date, sales[0].end_date) == (date(2026, 5, 5), None)


def test_gavelhouse_numeric_status_and_date_from_name():
    payload = {"id": 9, "name": "Thoroughbred 22 June 2026 auction", "status": 2}
    sales = gavelhouse.parse_catalogues(payload, REF)
    assert sales[0].status_hint == "live"
    assert sales[0].start_date == date(2026, 6, 22)


# --- JSON APIs ------------------------------------------------------------------ //


def test_gavelhouse_catalogue_and_lots():
    payload = {
        "id": 412,
        "name": "June Online Sale",
        "status": "live",
    }
    sales = gavelhouse.parse_catalogues(payload, REF)
    assert len(sales) == 1
    s = sales[0]
    assert s.online and s.country == "NZ"
    assert s.catalogue_ref == "412"
    assert s.start_date is None  # rolling auction: undated is fine
    assert s.status_hint == "live"

    lots = gavelhouse.parse_lots(
        [
            {
                "lotNumber": "12",
                "name": "Example Filly",
                "sex": "Filly",
                "colour": "Bay",
                "sire": "Example Sire",
                "dam": "Example Dam",
                "damSire": "Example Damsire",
                "vendor": "Example Farm",
            }
        ]
    )
    assert lots[0].lot_no == "12"
    assert lots[0].dam_sire == "Example Damsire"


def test_json_lot_parsers_tolerate_naming_styles():
    # snake_case + envelope, as the WP/Django backends variously return.
    keeneland_lots = keeneland.parse_lots(
        {"data": [{"hip_number": "101", "broodmare_sire": "Some Damsire",
                   "consignor": "Some Farm"}]}
    )
    assert keeneland_lots[0].lot_no == "101"
    assert keeneland_lots[0].dam_sire == "Some Damsire"
    assert keeneland_lots[0].vendor == "Some Farm"

    bbag_lots = bbag.parse_lots(
        {"lots": [{"catalogNumber": "7", "horseName": "Beispiel",
                   "sireOfDam": "Beispiel Damsire"}]}
    )
    assert bbag_lots[0].lot_no == "7"
    assert bbag_lots[0].horse_name == "Beispiel"
    assert bbag_lots[0].dam_sire == "Beispiel Damsire"

    # 200-with-empty-body means "not published yet": no lots, not an error.
    assert fasigtipton.parse_lots(None) == []


def test_pick_is_case_and_style_tolerant():
    record = {"lot_number": "9", "DamSire": "X"}
    assert pick(record, "lotNumber") == "9"
    assert pick(record, "damSire") == "X"
    assert pick(record, "missing", default="") == ""


# --- Colour / sex code expansion ----------------------------------------------- //


def test_expand_sex_and_colour_codes():
    assert expand_sex("F") == "Filly"
    assert expand_sex("G") == "Gelding"
    assert expand_sex("Filly") == "Filly"  # already spelled out -> unchanged
    assert expand_sex("") == ""
    assert expand_colour("B") == "Bay"
    assert expand_colour("DkB") == "Dark Bay"
    assert expand_colour("Ch") == "Chestnut"
    assert expand_colour("Blk. or G.") == "Blk. or G."  # descriptive -> unchanged
    assert expand_colour("") == ""


# --- NZB: catalogue embedded as HTML-escaped JSON in the sale page -------------- //


def test_nzb_embedded_lots_parse():
    catalogue = {
        "lots": [
            {
                "lot": 1,
                "horsename": "",  # weanlings/yearlings catalogued unnamed
                "sire": "Redwood",
                "sire_suffix": "GB",
                "dam": "Nakyama",
                "dam_suffix": "NZ",
                "dam_sire": "Pins",
                "sex": "Filly",
                "colour": "Bay",
                "vendor": "Westbury Stud",
                "withdrawn": False,
            },
            {  # withdrawn lots are not in the sale and must be dropped
                "lot": 2,
                "sire": "Ardrossan",
                "sex": "Colt",
                "withdrawn": True,
            },
        ]
    }
    page = f'<div data-page="{html.escape(json.dumps(catalogue))}"></div>'
    # The run-on date is trimmed off the heading; a year in the name survives.
    assert nzb._clean_name("National Weanling Sale25 June 2026 at Karaka") == (
        "National Weanling Sale"
    )
    assert nzb._clean_name("Karaka 2027 - Book 124 & 25 January 2027") == (
        "Karaka 2027 - Book 1"
    )
    lots = nzb.parse_lots(page)
    assert len(lots) == 1
    lot = lots[0]
    assert lot.lot_no == "1"
    assert lot.horse_name == ""
    # Suffix is reattached the way the other houses publish it.
    assert lot.sire == "Redwood (GB)"
    assert lot.dam == "Nakyama (NZ)"
    assert lot.dam_sire == "Pins"
    assert (lot.colour, lot.sex) == ("Bay", "Filly")
    assert lot.vendor == "Westbury Stud"
    # Missing/unparseable JSON is "no catalogue", never an error.
    assert nzb.parse_lots("<html>no json here</html>") == []


# --- Goffs: catalogue as data-* attributes (repeated per layout) ---------------- //


def test_goffs_data_attribute_lots_dedup():
    page = """
    <a class="lot-table__lot" data-lotnumber="1" data-lotname="Dee's Funny Girl (IRE)"
       data-sirename="Cotai Glory (GB)" data-damname="Comical (IRE)"
       data-damsire="Dark Angel (IRE)" data-colour="B" data-sex="F"
       data-consignor="Consign Ltd">view</a>
    <a class="lot-table__lot lot--mobile" data-lotnumber="1"
       data-sirename="Cotai Glory (GB)">duplicate layout of lot 1</a>
    <a class="lot-table__lot" data-lotnumber="2" data-lotname="Example Colt"
       data-sirename="No Nay Never (USA)" data-damname="Example (GB)"
       data-damsire="Galileo (IRE)" data-colour="DkB" data-sex="C"
       data-consignor="Another Farm">view</a>
    <a class="filter-widget" data-lotnumber="">noise, no pedigree</a>
    """
    lots = goffs.parse_lots(page)
    assert len(lots) == 2  # the repeated layout of lot 1 is collapsed
    first = lots[0]
    assert first.lot_no == "1"
    assert first.horse_name == "Dee's Funny Girl (IRE)"
    assert first.sire == "Cotai Glory (GB)"
    assert first.dam_sire == "Dark Angel (IRE)"
    assert (first.colour, first.sex) == ("Bay", "Filly")
    assert first.vendor == "Consign Ltd"
    assert (lots[1].colour, lots[1].sex) == ("Dark Bay", "Colt")


# --- Magic Millions: catalogue table with id-anchored cells --------------------- //


def test_magicmillions_catalogue_table_parse():
    page = """
    <table><tbody>
    <tr id="1" data-href="/lot/26PMY/1">
      <td id="lotnumber-1" class="lotnumber"><a href="/lot/26PMY/1">1</a></td>
      <td class="extras"></td>
      <td class="cataloguenameinfo" title="full vendor info">Yarradale Stud</td>
      <td id="colour-1">Blk. or G.</td>
      <td>G</td>
      <td id="sire-1">Gingerbread Man (AUS)</td>
      <td id="dam-1">Ofcourse She Does (AUS)</td>
      <td id="damsire-1">Murtajill (AUS)</td>
      <td class="bonusscheme">Westspeed Platinum</td>
    </tr>
    <tr><td>header or spacer row, no lot id</td></tr>
    </tbody></table>
    """
    lots = magicmillions.parse_lots(page)
    assert len(lots) == 1
    lot = lots[0]
    assert lot.lot_no == "1"
    assert lot.horse_name == ""  # yearlings unnamed
    assert lot.vendor == "Yarradale Stud"
    assert lot.colour == "Blk. or G."
    assert lot.sex == "Gelding"
    assert lot.sire == "Gingerbread Man (AUS)"
    assert lot.dam == "Ofcourse She Does (AUS)"
    assert lot.dam_sire == "Murtajill (AUS)"


def test_new_lot_sources_are_registered():
    # Regression guard: these three used to ship fetch_lots = None.
    for module in (nzb, goffs, magicmillions):
        assert callable(getattr(module, "fetch_lots", None))


# --- Orchestrator: per-source isolation + dedup --------------------------------- //


def _sale(house, name, source_key):
    return RawSale(house=house, country="UK", name=name,
                   start_date=date(2026, 7, 1), end_date=None,
                   url="https://x.test", source_key=source_key)


def test_collect_isolates_failures_and_dedups_first_wins():
    def ok(session, ref):
        return [_sale("HouseA", "July Sale", "ok")]

    def boom(session, ref):
        raise ValueError("site down")

    def dupe(session, ref):
        # Same catalogue identity as `ok`: first source must win.
        return [_sale("HouseA", "July Sale", "dupe")]

    sources = [Source("ok", ok, None), Source("boom", boom, None),
               Source("dupe", dupe, None)]
    sales, status = collect_raw_sales(None, REF, sources=sources)
    assert status == {"ok": "1", "boom": "ERR:ValueError", "dupe": "1"}
    assert len(sales) == 1
    assert sales[0].source_key == "ok"
