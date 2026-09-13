"""Tester av beregningslogikken med små, fiktive scenarioer.

Hver test beskriver scenarioet i klartekst, og fasiten er så enkel at den
kan kontrolleres ved å LESE den (3 stemmer for og 2 mot = flertall for).
Ingen fasit er regnet ut av koden som testes — det ville vært sirkelbevis.
Testene kjører den ekte analyse.py på et miniatyr-datalager i samme format
som Stortingets API leverer (se hjelpere.py).

Kjør:  python3 -m unittest discover -s pipeline/tests -v
"""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import analyse
from hjelpere import SESJON, skriv_lager, stemme, votering


def kjor_analyse(voteringer, stemmer, tmp):
    """Pek analyse.py mot miniatyr-lageret og analyser testsesjonen."""
    analyse.RAW = skriv_lager(tmp, voteringer, stemmer)
    return analyse.analyse_session(SESJON)


def rad(positions, vid):
    return next(r for r in positions if r["vid"] == vid)


class TestPartistandpunkt(unittest.TestCase):
    def test_flertall_avgjor_standpunktet(self):
        """Scenario: Testparti A har 5 representanter i salen. 3 stemmer for,
        2 stemmer mot. Fasit: A registreres med 3 for / 2 mot, altså
        standpunkt FOR (flertallet)."""
        with tempfile.TemporaryDirectory() as tmp:
            _, positions, *_ = kjor_analyse(
                [votering(1, "2099-11-15", 3, 2, True)],
                {1: [stemme("A1", "A", 2), stemme("A2", "A", 2), stemme("A3", "A", 2),
                     stemme("A4", "A", 3), stemme("A5", "A", 3)]}, tmp)
            self.assertEqual(rad(positions, 1)["partier"]["A"], [3, 2])

    def test_helt_likt_gir_delt_parti_som_ikke_telles(self):
        """Scenario: SV står 2 mot 2 (en femte representant er fraværende og
        teller ikke). H stemmer samlet mot med 3. Fasit: SV har ikke noe
        standpunkt, så paret SV|H får IKKE denne voteringen med i sitt
        regnestykke — verken som enig eller uenig."""
        with tempfile.TemporaryDirectory() as tmp:
            _, positions, matrix, *_ = kjor_analyse(
                [votering(1, "2099-11-15", 2, 5, False)],
                {1: [stemme("S1", "SV", 2), stemme("S2", "SV", 2),
                     stemme("S3", "SV", 3), stemme("S4", "SV", 3),
                     stemme("S5", "SV", 1),  # fraværende
                     stemme("H1", "H", 3), stemme("H2", "H", 3), stemme("H3", "H", 3)]},
                tmp)
            self.assertEqual(rad(positions, 1)["partier"]["SV"], [2, 2])
            par = [m for m in matrix if m["pair"] == "H|SV"]
            self.assertEqual(par, [], "delt parti skal ikke gi noe H|SV-par")

    def test_uavhengige_paavirker_ingen_partier(self):
        """Scenario: En uavhengig representant stemmer for, sammen med A (2 for).
        H stemmer mot (2). Fasit: Uav-stemmen registreres for seg og inngår
        ikke i noe partipar — A|H-paret teller 1 votering, uenige."""
        with tempfile.TemporaryDirectory() as tmp:
            _, positions, matrix, *_ = kjor_analyse(
                [votering(1, "2099-11-15", 3, 2, True)],
                {1: [stemme("U1", None, 2),
                     stemme("A1", "A", 2), stemme("A2", "A", 2),
                     stemme("H1", "H", 3), stemme("H2", "H", 3)]}, tmp)
            self.assertEqual(rad(positions, 1)["partier"]["Uav"], [1, 0])
            par = next(m for m in matrix if m["pair"] == "A|H")
            self.assertEqual((par["agree"], par["total"]), (0, 1))
            self.assertFalse(any("Uav" in m["pair"] for m in matrix),
                             "Uav skal aldri opptre i noe par")

    def test_stemmen_telles_for_partiet_ved_stemmetidspunktet(self):
        """Scenario: Representant X stemmer i november som FrP-medlem, og i
        mars — etter partibytte — som uavhengig. Fasit: novemberstemmen
        telles for FrP, marsstemmen for Uav. Historien skrives ikke om.
        (Samme regel dekker vararepresentanter: stemmen telles for det
        partiet stemmeregisteret oppgir for personen i akkurat den
        voteringen — testet med vara=True i marsstemmen.)"""
        with tempfile.TemporaryDirectory() as tmp:
            _, positions, *_ = kjor_analyse(
                [votering(1, "2099-11-15", 1, 0, True),
                 votering(2, "2100-03-15", 1, 0, True)],
                {1: [stemme("X", "FrP", 2)],
                 2: [stemme("X", None, 2, vara=True)]}, tmp)
            self.assertEqual(rad(positions, 1)["partier"], {"FrP": [1, 0]})
            self.assertEqual(rad(positions, 2)["partier"], {"Uav": [1, 0]})


class TestSpeilvoteringer(unittest.TestCase):
    def test_alternativ_votering_telles_en_gang(self):
        """Scenario: API-et leverer én alternativ votering som TO speilvendte
        rader (id 10: 3–2 vedtatt, id 11: 2–3 forkastet), lenket via
        alternativ_votering_id. Fasit: raden med høyest id (11) ekskluderes
        som 'alternativ_speil'; nøyaktig én av de to telles."""
        with tempfile.TemporaryDirectory() as tmp:
            felles = {10: [stemme("A1", "A", 2), stemme("A2", "A", 2), stemme("A3", "A", 2),
                           stemme("H1", "H", 3), stemme("H2", "H", 3)],
                      11: [stemme("A1", "A", 3), stemme("A2", "A", 3), stemme("A3", "A", 3),
                           stemme("H1", "H", 2), stemme("H2", "H", 2)]}
            summary, positions, *_ = kjor_analyse(
                [votering(10, "2099-11-15", 3, 2, True, alt=11),
                 votering(11, "2099-11-15", 2, 3, False, alt=10)], felles, tmp)
            self.assertIsNone(rad(positions, 10)["excluded"])
            self.assertEqual(rad(positions, 11)["excluded"], "alternativ_speil")
            self.assertEqual(summary["counted"], 1)
            self.assertEqual(summary["alternativ_speil"], 1)


class TestEkskluderingerOgVern(unittest.TestCase):
    def test_lovteknisk_votering_holdes_utenfor_men_slettes_ikke(self):
        """Scenario: En votering over 'lovens overskrift og loven i sin helhet'
        (lovteknisk bekreftelse, jf. Stortingets eget råd). Fasit: raden
        flagges 'lovteknisk' og telles ikke — men den finnes fortsatt i
        datasettet, for sporbarhet."""
        with tempfile.TemporaryDirectory() as tmp:
            summary, positions, *_ = kjor_analyse(
                [votering(1, "2099-11-15", 2, 0, True,
                          tema="Lovens overskrift og loven i sin helhet.")],
                {1: [stemme("A1", "A", 2), stemme("A2", "A", 2)]}, tmp)
            self.assertEqual(rad(positions, 1)["excluded"], "lovteknisk")
            self.assertEqual(summary["counted"], 0)
            self.assertEqual(len(positions), 1)

    def test_sesjonsgrensene_er_inkluderende_paa_begge_sider(self):
        """Scenario: Fire voteringer — dagen FØR sesjonsstart, på selve
        startdagen (1. okt.), på selve sluttdagen (30. sep.) og dagen ETTER.
        Fasit: nøyaktig de to på grensedagene telles med. (Tetter testhull
        påvist ved mutasjonstesting i den eksterne gjennomgangen.)"""
        with tempfile.TemporaryDirectory() as tmp:
            _, positions, *_ = kjor_analyse(
                [votering(1, "2099-09-30", 1, 0, True),
                 votering(2, "2099-10-01", 1, 0, True),
                 votering(3, "2100-09-30", 1, 0, True),
                 votering(4, "2100-10-01", 1, 0, True)],
                {v: [stemme("A1", "A", 2)] for v in (1, 2, 3, 4)}, tmp)
            self.assertEqual([r["vid"] for r in positions], [2, 3])

    def test_dato_settes_i_norsk_tid_ikke_utc(self):
        """Scenario: En votering kl. 00.30 norsk sommertid 16. juni 2023 —
        altså 22.30 UTC den 15. juni. Fasit: datoen skal være 2023-06-16
        (den norske datoen). UTC-formatering ville gitt 15. juni og kunne
        plassert nattlige voteringer i feil sesjon eller regjeringsperiode.
        (Feil funnet i den eksterne gjennomgangen, sept. 2026.)"""
        # 2023-06-15T22:30:00Z = 1686868200000 ms
        self.assertEqual(analyse.date_of("/Date(1686868200000+0200)/"), "2023-06-16")

    def test_votering_utenfor_sesjonens_datoer_droppes(self):
        """Scenario: Saker kan gå over flere sesjoner, så samme votering kan
        dukke opp i flere sesjonsfiler. En votering datert FØR testsesjonens
        start (2099-10-01) skal ikke telles i denne sesjonen. Fasit: bare
        voteringen innenfor datogrensene er med."""
        with tempfile.TemporaryDirectory() as tmp:
            summary, positions, *_ = kjor_analyse(
                [votering(1, "2099-05-15", 1, 0, True),   # før sesjonsstart
                 votering(2, "2099-11-15", 1, 0, True)],  # innenfor
                {1: [stemme("A1", "A", 2)], 2: [stemme("A1", "A", 2)]}, tmp)
            self.assertEqual([r["vid"] for r in positions], [2])
            self.assertEqual(summary["voteringer"], 1)

    def test_manglende_individdata_ekskluderes_som_data_pending(self):
        """Scenario: En votering har offisielle tall, men ingen enkeltstemmer
        (slik API-et faktisk oppfører seg for 11 kjente voteringer). Fasit:
        raden flagges 'data_pending' og telles ikke i prosentene."""
        with tempfile.TemporaryDirectory() as tmp:
            summary, positions, *_ = kjor_analyse(
                [votering(1, "2099-11-15", 50, 40, True)], {}, tmp)
            self.assertEqual(rad(positions, 1)["excluded"], "data_pending")
            self.assertEqual(summary["counted"], 0)

    def test_avvik_mot_offisielle_tall_flagges(self):
        """Scenario: Enkeltstemmene summerer til 2–0, men de offisielle
        tallene sier 3–0 (én stemme 'mangler'). Fasit: raden flagges som
        IKKE verifisert og avviket telles — nettstedet skjuler aldri slike
        avvik. En identisk votering der tallene stemmer, verifiseres."""
        with tempfile.TemporaryDirectory() as tmp:
            summary, positions, *_ = kjor_analyse(
                [votering(1, "2099-11-15", 3, 0, True),
                 votering(2, "2099-11-16", 2, 0, True)],
                {1: [stemme("A1", "A", 2), stemme("A2", "A", 2)],
                 2: [stemme("A1", "A", 2), stemme("A2", "A", 2)]}, tmp)
            self.assertIs(rad(positions, 1)["verified"], False)
            self.assertIs(rad(positions, 2)["verified"], True)
            self.assertEqual(summary["verify_mismatches"], 1)


class TestEnighetOgSplittelser(unittest.TestCase):
    def test_parvis_enighet_telles_votering_for_votering(self):
        """Scenario: Tre voteringer. A og H stemmer likt i to av dem (begge
        for; begge mot) og ulikt i den tredje. Fasit: A|H = enige i 2 av 3."""
        with tempfile.TemporaryDirectory() as tmp:
            beg_for = [stemme("A1", "A", 2), stemme("H1", "H", 2)]
            beg_mot = [stemme("A1", "A", 3), stemme("H1", "H", 3)]
            ulikt = [stemme("A1", "A", 2), stemme("H1", "H", 3)]
            _, _, matrix, *_ = kjor_analyse(
                [votering(1, "2099-11-15", 2, 0, True),
                 votering(2, "2099-11-16", 0, 2, False),
                 votering(3, "2099-11-17", 1, 1, False)],
                {1: beg_for, 2: beg_mot, 3: ulikt}, tmp)
            par = next(m for m in matrix if m["pair"] == "A|H")
            self.assertEqual((par["agree"], par["total"]), (2, 3))

    def test_splittelse_krever_minst_to_utbrytere(self):
        """Scenario: I samme votering står H 3–2 (to utbrytere) og A 4–1 (én
        utbryter). Fasit: bare H havner på splittelseslisten — én enkelt
        utbryter kan være et feiltrykk, som aldri rettes i kildedataene."""
        with tempfile.TemporaryDirectory() as tmp:
            resultat = kjor_analyse(
                [votering(1, "2099-11-15", 7, 3, True)],
                {1: [stemme("H1", "H", 2), stemme("H2", "H", 2), stemme("H3", "H", 2),
                     stemme("H4", "H", 3), stemme("H5", "H", 3),
                     stemme("A1", "A", 2), stemme("A2", "A", 2),
                     stemme("A3", "A", 2), stemme("A4", "A", 2),
                     stemme("A5", "A", 3)]}, tmp)
            splits = resultat[4]
            self.assertEqual([(s["parti"], s["for"], s["mot"]) for s in splits],
                             [("H", 3, 2)])


class TestRegjeringsperioder(unittest.TestCase):
    def test_votering_havner_i_riktig_regjeringsperiode(self):
        """Scenario: To voteringer i sesjonen 2021-2022 — én 13. oktober 2021
        (dagen før regjeringsskiftet) og én 14. oktober (dagen Støre tok
        over; dato fra regjeringen.no, se pipeline/regjeringer.json). Fasit:
        den første telles i Solberg-perioden, den andre i Støre-perioden,
        og ingen annen periode får noen. (Tetter testhull påvist ved
        mutasjonstesting i den eksterne gjennomgangen.)"""
        with tempfile.TemporaryDirectory() as tmp:
            raw = skriv_lager(
                Path(tmp) / "raw",
                [votering(1, "2021-10-13", 1, 0, True),
                 votering(2, "2021-10-14", 1, 0, True)],
                {1: [stemme("A1", "A", 2)], 2: [stemme("A1", "A", 2)]},
                sesjon="2021-2022", fra="2021-10-01", til="2022-09-30")
            gammel_raw, gammel_out, gammel_argv = analyse.RAW, analyse.OUT, sys.argv
            try:
                analyse.RAW = raw
                analyse.OUT = Path(tmp) / "out"
                sys.argv = ["analyse.py", "2021-2022"]
                analyse.main()
                eras = json.loads((analyse.OUT / "eras.json").read_text())
            finally:
                analyse.RAW, analyse.OUT, sys.argv = gammel_raw, gammel_out, gammel_argv
            per_era = {(e["navn"], e["fra"]): e["voteringer"] for e in eras}
            self.assertEqual(per_era[("Solberg", "2020-01-24")], 1)
            self.assertEqual(per_era[("Støre", "2021-10-14")], 1)
            self.assertEqual(sum(per_era.values()), 2,
                             "ingen andre regjeringsperioder skal få voteringer")


if __name__ == "__main__":
    unittest.main()
