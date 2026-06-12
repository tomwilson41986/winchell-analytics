"""Date-range parser edge cases (livesales spec §4): the houses publish a
dozen formats, with and without years, day-first and month-first."""

from datetime import date

from pipeline.livesales.base import find_sex_colour, parse_date_range, split_sex_colour

REF = date(2026, 6, 12)


def test_explicit_range_with_year():
    assert parse_date_range("6 – 8 October 2026", REF) == (
        date(2026, 10, 6),
        date(2026, 10, 8),
    )


def test_single_day_with_weekday_no_year():
    assert parse_date_range("Mon 2 Sep", REF) == (date(2026, 9, 2), None)


def test_cross_month_range():
    assert parse_date_range("30 January - 4 February", date(2026, 1, 2)) == (
        date(2026, 1, 30),
        date(2026, 2, 4),
    )


def test_month_first_us_style():
    assert parse_date_range("October 6-8", REF, dayfirst=False) == (
        date(2026, 10, 6),
        date(2026, 10, 8),
    )


def test_opening_month_word_forces_month_first_even_when_dayfirst():
    assert parse_date_range("October 6-8", REF, dayfirst=True) == (
        date(2026, 10, 6),
        date(2026, 10, 8),
    )


def test_ordinals_and_abbreviated_month():
    assert parse_date_range("1st - 3rd Dec", REF) == (
        date(2026, 12, 1),
        date(2026, 12, 3),
    )


def test_missing_year_rolls_forward_when_long_past():
    # Ref is December; a bare "10 - 12 February" ended >60 days ago, so it
    # must mean next February.
    assert parse_date_range("10 - 12 February", date(2026, 12, 1)) == (
        date(2027, 2, 10),
        date(2027, 2, 12),
    )


def test_sixty_day_grace_keeps_recent_sale_in_current_year():
    # A sale that finished three weeks ago stays in the current year.
    assert parse_date_range("18 - 20 May", date(2026, 6, 12)) == (
        date(2026, 5, 18),
        date(2026, 5, 20),
    )


def test_year_boundary_range():
    assert parse_date_range("30 December - 2 January 2026", REF) == (
        date(2026, 12, 30),
        date(2027, 1, 2),
    )


def test_to_and_ampersand_separators():
    assert parse_date_range("6 to 8 October 2026", REF) == (
        date(2026, 10, 6),
        date(2026, 10, 8),
    )
    assert parse_date_range("6 & 7 October 2026", REF) == (
        date(2026, 10, 6),
        date(2026, 10, 7),
    )


def test_book_prefix_stripped():
    # "Book 1" must not be read as a day number.
    assert parse_date_range("Book 1: 6 - 9 October 2026", REF) == (
        date(2026, 10, 6),
        date(2026, 10, 9),
    )


def test_no_month_word_returns_none():
    assert parse_date_range("Date TBC", REF) == (None, None)
    assert parse_date_range("", REF) == (None, None)
    assert parse_date_range(None, REF) == (None, None)


def test_same_start_end_collapses_to_single_day():
    assert parse_date_range("2 - 2 Sep 2026", REF) == (date(2026, 9, 2), None)


def test_en_dash_and_em_dash():
    assert parse_date_range("6–8 October 2026", REF) == (
        date(2026, 10, 6),
        date(2026, 10, 8),
    )
    assert parse_date_range("6—8 October 2026", REF) == (
        date(2026, 10, 6),
        date(2026, 10, 8),
    )


# --- colour+sex tokens ------------------------------------------------------ //


def test_split_sex_colour_basic():
    assert split_sex_colour("B.F.") == ("Bay", "Filly")
    assert split_sex_colour("Ch.C") == ("Chestnut", "Colt")
    assert split_sex_colour("Gr.G.") == ("Grey", "Gelding")
    assert split_sex_colour("Dkb.M") == ("Dark Bay", "Mare")


def test_split_sex_colour_rejects_noise():
    assert split_sex_colour("XYZ") == ("", "")
    assert split_sex_colour("F") == ("", "")
    assert split_sex_colour("") == ("", "")


def test_find_sex_colour_in_tail_text():
    assert find_sex_colour("lovely walker 2023 Ch.F. consigned by X") == (
        "Chestnut",
        "Filly",
    )
    assert find_sex_colour("no token here") == ("", "")
