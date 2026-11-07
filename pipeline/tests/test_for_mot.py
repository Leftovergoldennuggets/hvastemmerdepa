"""Tester av for/mot-nedbrytningen (analyse_for_mot.py).

Bakgrunn: «stemte likt» teller både når to partier begge stemte for og når
begge stemte mot. Etter innspill fra lesere (november 2026) brytes tallet ned
i begge for / begge mot / ulikt, per type votering. Testene har tre deler:

1. Typen votering leses rett ut av Stortingets beskrivelsestekst — fasiten er
   å lese teksten.
2. Et lite, fiktivt scenario der fasiten kan telles for hånd, kjørt gjennom
   den EKTE analyse.py og deretter analyse_for_mot.py. Og en test som viser at
   kontrollen stopper jobben hvis nedbrytningen ikke summerer til matrisen.
3. En ekte sak (103140, mai 2025, samme fixture som test_ekte_data.py) der
   Ap og Høyre stemte likt i alle fire voteringer — tre ganger ved at begge
   stemte MOT forslag fra SV, R og MDG, én gang ved å velge innstillingen.
   Fasit-kilde: https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=103140

Kjør:  python3 -m unittest discover -s pipeline/tests -v
"""
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import analyse
import analyse_for_mot as fm
from hjelpere import SESJON, skriv_lager, stemme, votering

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "ekte"


def kjor_for_mot(raw, sesjon, endre_matrise=None):
    """Kjør analyse.py på et rådatalager, skriv resultatet slik pipelinen
    gjør, og kjør analyse_for_mot.py på det. Returnerer for_mot-filen.
    endre_matrise: funksjon som får tukle med matrisen først (mutasjonstest)."""
    original_raw, original_comp = analyse.RAW, fm.COMPUTED
    try:
        analyse.RAW = raw
        summary, positions, matrix, komite, _ = analyse.analyse_session(sesjon)
        with tempfile.TemporaryDirectory() as tmp:
            comp = Path(tmp)
            for d in ("positions", "matrix", "matrix_komite"):
                (comp / d).mkdir()
            (comp / "sessions.json").write_text(json.dumps([summary]))
            (comp / "positions" / f"{sesjon}.json").write_text(json.dumps(positions))
            if endre_matrise:
                endre_matrise(matrix)
            (comp / "matrix" / f"{sesjon}.json").write_text(json.dumps(matrix))
            (comp / "matrix_komite" / f"{sesjon}.json").write_text(json.dumps(komite))
            fm.COMPUTED = comp
            # analyse_for_mot.py stops the daily job with sys.exit when its
            # sums do not match the matrix. Turn that into a normal test
            # failure, so a fault is reported per test instead of aborting
            # the whole test run.
            with redirect_stdout(io.StringIO()):
                try:
                    fm.main()
                except SystemExit as e:
                    raise AssertionError(
                        "analyse_for_mot.py stoppet: nedbrytningen summerer ikke "
                        "til matrisen") from e
            return json.loads((comp / "for_mot" / f"{sesjon}.json").read_text())
    finally:
        analyse.RAW, fm.COMPUTED = original_raw, original_comp


def par(resultat, key):
    return next(p for p in resultat["pairs"] if p["pair"] == key)


class TestTypeVotering(unittest.TestCase):
    """Fasiten leses rett ut av beskrivelsesteksten. Alle tekstene er
    hentet ordrett fra Stortingets data."""

    def typ(self, tema, alt=None):
        return fm.votetype({"tema": tema, "alt": alt})

    def test_partiforslag(self):
        self.assertEqual(self.typ("Forslag nr. 12 på vegne av SV, R og MDG."), "forslag")
        self.assertEqual(self.typ("Forslag nr. 52 på vegne av FrP."), "forslag")

    def test_komiteens_innstilling(self):
        for tema in ("Innstillingens tilråding", "Romertall II.",
                     "Stor bokstav B romertall I", "Kapitlene 5, 6 og 7"):
            with self.subTest(tema=tema):
                self.assertEqual(self.typ(tema), "innstilling")

    def test_alternativ_votering_kjennes_igjen_paa_tekst_og_lenke(self):
        """Begge måter: teksten sier «alternativ» (også når API-et ikke har
        lenket tvillingen, som votering 3541), eller raden har en alt-lenke."""
        self.assertEqual(self.typ(
            "Alternativ votering mellom innstillingen og forslag nr. 1 fra FrP"), "alternativ")
        self.assertEqual(self.typ(
            "Alternativ votering mellom innstillingen og forslagene 1 -  4 på vegne av "
            "SV, R, V, og KrF."), "alternativ")
        self.assertEqual(self.typ("Innstillingens tilråding", alt=24897), "alternativ")

    def test_prosedyre_og_uklare_forslag_er_annet(self):
        for tema in ("Behandlingsmåte", "Tilbakesending til komite", "Forslag nr. 1",
                     "Utsettelsesforslag sakene 7, 8 og 9.", "Representantforslaget pkt. 2",
                     "", "Forslag nr. 3 på vegne av FrP og uavhengig representant Ulf Leirstein"):
            with self.subTest(tema=tema):
                self.assertEqual(self.typ(tema), "annet")


class TestFiktivtScenario(unittest.TestCase):
    """Tre partier: A og H med to representanter hver, SV med én.

      1  «Innstillingens tilråding»         A for, H for, SV mot
      2  «Forslag nr. 1 på vegne av SV.»    A mot, H mot, SV for
      3  «Forslag nr. 2 på vegne av SV.»    A for, H mot, SV for
      4  alternativ votering (5 er speilet) A for, H for, SV mot

    Fasit for paret A|H, telt for hånd:
      innstilling: begge for 1, begge mot 0, ulikt 0
      forslag:     begge for 0, begge mot 1, ulikt 1
      alternativ:  likt 1, ulikt 0
      → stemte likt 3 av 4 (som i matrisen), stemte for det samme 1 av 2
        (votering 1 og 3), stemte mot det samme 1 av 2 (votering 2 og 3).
    """

    VOTERINGER = [
        votering(1, "2099-11-15", 4, 1, True, tema="Innstillingens tilråding"),
        votering(2, "2099-11-15", 1, 4, False, tema="Forslag nr. 1 på vegne av SV."),
        votering(3, "2099-11-15", 3, 2, True, tema="Forslag nr. 2 på vegne av SV."),
        votering(4, "2099-11-15", 4, 1, True, alt=5,
                 tema="Alternativ votering mellom innstillingen og forslag nr. 3 fra SV"),
        votering(5, "2099-11-15", 1, 4, False, alt=4,
                 tema="Alternativ votering mellom innstillingen og forslag nr. 3 fra SV"),
    ]

    @staticmethod
    def stemmer(a, h, sv):
        return [stemme("A1", "A", a), stemme("A2", "A", a),
                stemme("H1", "H", h), stemme("H2", "H", h), stemme("S1", "SV", sv)]

    def resultat(self, endre_matrise=None):
        FOR, MOT = 2, 3
        with tempfile.TemporaryDirectory() as tmp:
            raw = skriv_lager(tmp, self.VOTERINGER, {
                1: self.stemmer(FOR, FOR, MOT),
                2: self.stemmer(MOT, MOT, FOR),
                3: self.stemmer(FOR, MOT, FOR),
                4: self.stemmer(FOR, FOR, MOT),
                5: self.stemmer(MOT, MOT, FOR),  # speilet: alle snudd
            })
            return kjor_for_mot(raw, SESJON, endre_matrise)

    def test_handtelt_fasit_for_A_og_H(self):
        ah = par(self.resultat(), "A|H")
        self.assertEqual(ah["innstilling"], [1, 0, 0])
        self.assertEqual(ah["forslag"], [0, 1, 1])
        self.assertEqual(ah["annet"], [0, 0, 0])
        self.assertEqual(ah["alternativ"], [1, 0])

    def test_antall_per_type(self):
        """Speiltvillingen (5) telles ikke — fire voteringer i alt."""
        self.assertEqual(self.resultat()["antall"],
                         {"innstilling": 1, "forslag": 2, "annet": 0, "alternativ": 1})

    def test_hver_votering_har_sin_type(self):
        """Hvilken type hver votering fikk, står i filen (åpne data)."""
        self.assertEqual(self.resultat()["typer"],
                         {"innstilling": [1], "forslag": [2, 3], "annet": [], "alternativ": [4]})

    def test_kontrollen_stopper_jobben_hvis_summen_ikke_stemmer(self):
        """Mutasjonstest: tukler vi med matrisen (én «enig» for mye for A|H),
        skal analyse_for_mot.py avslutte med feil i stedet for å publisere."""
        def tukle(matrix):
            for r in matrix:
                if r["pair"] == "A|H":
                    r["agree"] += 1
        with self.assertRaisesRegex(AssertionError, "summerer ikke"):
            self.resultat(endre_matrise=tukle)


class TestEkteSak(unittest.TestCase):
    """Sak 103140 (fixture fra Stortingets API, se test_ekte_data.py).
    Fasit lest av voteringsoversikten på stortinget.no:
      24893 «Forslag nr. 12 på vegne av SV, R og MDG»  14–86: Ap mot, H mot
      24894 «Forslag nr. 11 på vegne av SV, R, V og MDG» 19–82: Ap mot, H mot
      24895 «Forslag nr. 4–10 på vegne av Sp, SV, R og MDG» 33–68: Ap mot, H mot, Sp for
      24896 alternativ votering 63–38: Ap og H for innstillingen, Sp mot
    """

    @classmethod
    def setUpClass(cls):
        cls.res = kjor_for_mot(FIXTURES, "2024-2025")

    def test_ap_og_hoyre_stemte_likt_ved_aa_stemme_mot(self):
        ah = par(self.res, "A|H")
        self.assertEqual(ah["forslag"], [0, 3, 0])   # tre ganger begge mot
        self.assertEqual(ah["alternativ"], [1, 0])   # valgte samme alternativ
        self.assertEqual(ah["innstilling"], [0, 0, 0])

    def test_hoyre_og_sp(self):
        hsp = par(self.res, "H|Sp")
        self.assertEqual(hsp["forslag"], [0, 2, 1])  # 24893, 24894 begge mot; 24895 ulikt
        self.assertEqual(hsp["alternativ"], [0, 1])  # 24896: ulike alternativer


if __name__ == "__main__":
    unittest.main()
