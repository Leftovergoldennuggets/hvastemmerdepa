"""Tester av «tid på Stortinget» og av salen slik den er i dag
(analyse_personer.py, endret november 2026).

Fiktive biografier i samme format som Stortingets API, der fasiten kan
regnes for hånd:

  GAP   innvalgt 1989–1993 og igjen fra 2025 (som Tor Mikkel Wara).
        Fasit ved periodestart 2025: 4,0 år — ikke 36 (hullet telles ikke).
  DOD   vara som rykket opp ved dødsfall 21.8.2006; biografien har samme
        tidsrom både som «Representant» og som «VARA»-permisjon.
        Fasit ved 1.10.2009: 21.8.2006–30.9.2009 = 1136 dager = 3,1 år,
        talt én gang.
  MIN   statsråd med permisjon; «Ola Vara» møter for henne (står bare med
        navn i MINs biografi). Fasit: OVA får tiden 1.1.2020–1.1.2022
        (731 dager = 2,0 år) som møtende vara.

Kjør:  python3 -m unittest discover -s pipeline/tests -v
"""
import datetime
import gzip
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import analyse_personer as ap


def ms(iso):
    d = datetime.datetime.fromisoformat(iso + "T12:00:00+00:00")
    return f"/Date({int(d.timestamp() * 1000)}+0200)/"


def periode(pid_periode, fra, til, verv="Representant"):
    return {"stortingsperiode_id": pid_periode, "verv": verv,
            "fra_dato": ms(fra), "til_dato": ms(til)}


def rep(pid, fornavn, etternavn, parti="A"):
    return {"id": pid, "fornavn": fornavn, "etternavn": etternavn, "kjoenn": 1,
            "foedselsdato": ms("1980-01-01"), "parti": {"id": parti},
            "fylke": {"navn": "Oslo"}, "vara_representant": False}


BIOS = {
    "GAP": {"stortingsperiode_kodet_liste": [
        periode("1989-93", "1989-09-30", "1993-09-30"),
        periode("2025-2029", "2025-09-30", "2029-09-30")]},
    "DOD": {"stortingsperiode_kodet_liste": [
        periode("2005-2009", "2005-09-30", "2006-08-21", "Vararepresentant"),
        periode("2005-2009", "2006-08-21", "2009-09-30")],
        "permisjon_kodet_liste": [{"type": "VARA", "fravaer_grunn": "DØDSFALL",
                                   "fra_dato": ms("2006-08-21"), "til_dato": ms("2009-09-30")}]},
    "MIN": {"stortingsperiode_kodet_liste": [periode("2017-2021", "2017-09-30", "2021-09-30")],
            "permisjon_kodet_liste": [{"type": "BORTE", "fravaer_grunn": "REGJ",
                                       "fra_dato": ms("2020-01-01"), "til_dato": ms("2022-01-01"),
                                       "vara_fornavn": "Ola", "vara_etternavn": "Vara"}]},
    "OVA": {},
}


class Lager:
    """Et miniatyr-rådatalager i en midlertidig mappe."""

    def __init__(self, tmp, reps, dagens=None, bios=BIOS):
        self.raw = Path(tmp)

        def gz(rel, innhold):
            p = self.raw / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(gzip.compress(json.dumps(innhold).encode()))

        gz("representanter/2025-2029.json.gz", {"representanter_liste": reps})
        for pid, b in bios.items():
            gz(f"biografi/{pid}.json.gz", {"person_id": pid, **b})
        if dagens is not None:
            gz("dagensrepresentanter.json.gz", {"dagensrepresentanter_liste": dagens})

    def __enter__(self):
        self.gammel = ap.RAW
        ap.RAW = self.raw
        ap.biografi.__defaults__[0].clear()
        ap._SPANS = None
        return self

    def __exit__(self, *a):
        ap.RAW = self.gammel
        ap.biografi.__defaults__[0].clear()
        ap._SPANS = None


class TestTidPaaStortinget(unittest.TestCase):
    REPS = [rep("GAP", "Gro", "Gap"), rep("DOD", "Dag", "Dod"),
            rep("MIN", "Mia", "Min"), rep("OVA", "Ola", "Vara")]

    def test_hull_i_karrieren_telles_ikke(self):
        with tempfile.TemporaryDirectory() as tmp, Lager(tmp, self.REPS):
            self.assertAlmostEqual(ap.years_before("GAP", datetime.date(2025, 10, 1)), 4.0, places=2)

    def test_samme_tidsrom_telles_bare_en_gang(self):
        with tempfile.TemporaryDirectory() as tmp, Lager(tmp, self.REPS):
            self.assertAlmostEqual(ap.years_before("DOD", datetime.date(2009, 10, 1)),
                                   1136 / 365.25, places=3)

    def test_vara_tid_fra_en_annens_biografi(self):
        """OVA har tom biografi; tiden står bare med navn hos MIN."""
        with tempfile.TemporaryDirectory() as tmp, Lager(tmp, self.REPS):
            self.assertAlmostEqual(ap.years_before("OVA", datetime.date(2025, 10, 1)),
                                   731 / 365.25, places=3)

    def test_offisiell_ansiennitet_regnes_tilbake_til_periodestart(self):
        """Wara-tilfellet: Stortinget oppgir 4 år og 281 dager 8.7.2026.
        Fra periodestart 1.10.2025 til 8.7.2026 er det 280 dager.
        Fasit: 4 + (281 − 280)/365,25 ≈ 4,0 år."""
        bio = {"GAP": {**BIOS["GAP"], "respons_dato_tid": ms("2026-07-08"),
                       "personalia_kodet": {"ansiennitet_aar": 4, "ansiennitet_dager": 281}}}
        with tempfile.TemporaryDirectory() as tmp, Lager(tmp, self.REPS, bios=bio):
            v = ap.official_years_at("GAP", "2025-2029", datetime.date(2025, 10, 1))
            self.assertAlmostEqual(v, 4 + 1 / 365.25, places=3)


class TestSalenIDag(unittest.TestCase):
    """160 valgte; statsråden S1 erstattes av vara V1 som møter fast for henne."""

    def setUp(self):
        self.valgte = [rep(f"P{i}", "Navn", f"Nr{i:03d}") for i in range(159)] + \
                      [rep("S1", "Stine", "Statsråd")]
        vara = {**rep("V1", "Vera", "Vara"), "vara_representant": True,
                "fast_vara_for": {"id": "S1"}}
        self.dagens = [r for r in self.valgte if r["id"] != "S1"] + [vara]

    def test_statsraaden_erstattes_av_varaen(self):
        with tempfile.TemporaryDirectory() as tmp, Lager(tmp, self.valgte, self.dagens):
            ut, erstattet = ap.sammensetning_i_dag(self.valgte)
        ids = {r["id"] for r in ut}
        self.assertNotIn("S1", ids)
        self.assertIn("V1", ids)
        self.assertEqual(len(ut), 160)
        self.assertEqual(erstattet, [{"id": "S1", "navn": "Stine Statsråd", "parti": "A",
                                      "vara_id": "V1", "vara_navn": "Vera Vara"}])

    def test_liste_som_ikke_passer_perioden_gir_de_valgte(self):
        """Etter et valg kan dagens liste gjelde en annen periode: varaen
        møter for noen som ikke er blant de valgte. Da beholdes de valgte."""
        feil = [*self.dagens[:-1], {**self.dagens[-1], "fast_vara_for": {"id": "UKJENT"}}]
        with tempfile.TemporaryDirectory() as tmp, Lager(tmp, self.valgte, feil):
            ut, erstattet = ap.sammensetning_i_dag(self.valgte)
        self.assertIsNone(erstattet)
        self.assertEqual(ut, self.valgte)


if __name__ == "__main__":
    unittest.main()
