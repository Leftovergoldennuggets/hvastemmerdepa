"""Tester mot EKTE data fra Stortinget, med offisielle tall som fasit.

Fixturene i fixtures/ekte/ er uendrede rådatafiler fra Stortingets API for
én ekte sak (103140, «Representantforslag om styrka jordvern for betre
beredskap», mai 2025) — valgt fordi den inneholder både en alternativ
votering (speilparet 24896/24897) og ordinære partiforslag. Bare sakslisten
er redusert til denne ene saken; voterings- og stemmefilene er identiske
med API-ets svar.

FASIT-KILDE (klikk og kontroller selv): saksiden hos Stortinget viser
voteringsoversikten med de offisielle tallene:
  https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=103140

Kjør:  python3 -m unittest discover -s pipeline/tests -v
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import analyse

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "ekte"


class TestEkteSak(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._raw = analyse.RAW
        analyse.RAW = FIXTURES
        resultat = analyse.analyse_session("2024-2025")
        assert resultat is not None, "fixture-lageret er ufullstendig"
        cls.summary, cls.positions, cls.matrix, cls.komite, cls.splits = resultat

    @classmethod
    def tearDownClass(cls):
        analyse.RAW = cls._raw

    def rad(self, vid):
        return next(r for r in self.positions if r["vid"] == vid)

    def test_offisielle_tall_for_alternativ_voteringen(self):
        """Fasit fra stortinget.no (lenken øverst): den alternative voteringen
        22. mai 2025 endte 63–38 og ble vedtatt."""
        r = self.rad(24896)
        self.assertEqual((r["for"], r["mot"], r["vedtatt"]), (63, 38, True))

    def test_offisielle_tall_for_partiforslaget(self):
        """Fasit fra stortinget.no: «Forslag nr. 12 på vegne av SV, R og MDG»
        fikk 14 stemmer for og 86 mot, og ble ikke vedtatt."""
        r = self.rad(24893)
        self.assertEqual((r["for"], r["mot"], r["vedtatt"]), (14, 86, False))

    def test_speilparet_telles_nokyaktig_en_gang(self):
        """API-et leverer den alternative voteringen som to speilvendte rader
        (24896: 63–38 og 24897: 38–63 — samme representanter, byttet
        fortegn). Én beslutning skal telles én gang: tvillingen med høyest
        id ekskluderes."""
        self.assertIsNone(self.rad(24896)["excluded"])
        self.assertEqual(self.rad(24897)["excluded"], "alternativ_speil")
        self.assertEqual(self.summary["recorded"], 5)
        self.assertEqual(self.summary["counted"], 4)

    def test_enkeltstemmene_summerer_til_de_offisielle_tallene(self):
        """Egenskapstest uten håndregnet fasit: for hver votering skal summen
        av partienes for/mot-stemmer være NØYAKTIG lik Stortingets offisielle
        for/mot-tall — to uavhengige registreringer av samme hendelse."""
        for r in self.positions:
            with self.subTest(votering=r["vid"]):
                self.assertIs(r["verified"], True)
                tot_f = sum(f for f, _ in r["partier"].values())
                tot_m = sum(m for _, m in r["partier"].values())
                self.assertEqual((tot_f, tot_m), (r["for"], r["mot"]))

    def test_speilradene_er_perfekte_speil(self):
        """Egenskapstest: i speilparet skal hvert partis for/mot i den ene
        raden være mot/for i den andre — bekrefter at hvilken tvilling som
        beholdes ikke kan påvirke noe enig/uenig-utfall."""
        a, b = self.rad(24896)["partier"], self.rad(24897)["partier"]
        self.assertEqual(set(a), set(b))
        for parti in a:
            self.assertEqual(a[parti], list(reversed(b[parti])),
                             f"{parti} er ikke speilvendt")


if __name__ == "__main__":
    unittest.main()
