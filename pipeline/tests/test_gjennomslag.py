"""Tester av gjennomslag-beregningen (hvem får forslagene sine vedtatt).

To deler:
1. Tekst-tolkingen av forslagsstillere («på vegne av …» / «fra …») testes
   direkte med ekte beskrivelsestekster fra API-et — fasiten er å lese rett
   ut av teksten.
2. Vedtatt-logikken for alternativ votering testes mot to EKTE voteringer
   som ble håndverifisert mot stortinget.no under revisjonen i juli 2026
   (AUDIT.md, punkt B1). Radene under er kopiert uendret fra
   data/computed/positions/. Fasit-kilder (klikk og kontroller):
     votering 3381, sak 55618: 0–94, forslaget fra FrP/H/KrF ble FORKASTET
       https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=55618
     votering 3541, sak 56512: 62–41, innstillingen vant — FrPs forslag falt
       https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=56512

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

import analyse_gjennomslag as gj

# Kopiert uendret fra data/computed/positions/2012-2013.json (kept mirror
# twins; the excluded twins are irrelevant here). See docstring for sources.
RAD_3381 = {"vid": 3381, "alt": 3382, "sak": 55618, "tittel": "Endringer i utlendingsloven",
            "komite": "KOMMFORV", "dato": "2013-06-03",
            "tema": "Alternativ votering mellom innstillingen og forslag nr.1 fra FrP, H og KrF",
            "vedtatt": False, "fri": False, "for": 0, "mot": 94, "verified": True,
            "excluded": None,
            "partier": {"A": [0, 37], "FrP": [0, 22], "H": [0, 15], "KrF": [0, 6],
                        "SV": [0, 6], "Sp": [0, 7], "V": [0, 1]}}
RAD_3541 = {"vid": 3541, "alt": None, "sak": 56512, "tittel": "Representantforslag om arbeidsinnvandring",
            "komite": "KOMMFORV", "dato": "2013-06-10",
            "tema": "Alternativ votering mellom innstillingen og forslag nr. 1 fra FrP",
            "vedtatt": True, "fri": False, "for": 62, "mot": 41, "verified": True,
            "excluded": None,
            "partier": {"A": [41, 0], "FrP": [0, 24], "H": [0, 17], "KrF": [6, 0],
                        "SV": [7, 0], "Sp": [7, 0], "V": [1, 0]}}
# Kopiert uendret fra data/computed/positions/2024-2025.json — ordinært
# partiforslag (14–86, ikke vedtatt), fasit på saksiden:
#   https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=103093
RAD_24893 = {"vid": 24893, "alt": None, "sak": 103093,
             "tittel": "Representantforslag om nasjonalt vern av matjorda",
             "komite": "NÆRING", "dato": "2025-05-22",
             "tema": "Forslag nr. 12 på vegne av SV, R og MDG.",
             "vedtatt": False, "fri": False, "for": 14, "mot": 86, "verified": True,
             "excluded": None,
             "partier": {"A": [0, 28], "FrP": [0, 12], "H": [0, 22], "KrF": [0, 2],
                         "MDG": [1, 0], "R": [5, 0], "SV": [8, 0], "Sp": [0, 17],
                         "V": [0, 5]}}

# Kopiert uendret fra data/computed/positions/ — to alternative voteringer
# der forslagsstillerne står med «på vegne av». Fasit i testen nedenfor.
RAD_25700 = {"vid": 25700, "alt": 25701, "sak": 103154,
             "tittel": "Representantforslag om å setja fredsarbeid i sentrum av norsk utanrikspolitikk",
             "komite": "UFK", "dato": "2025-06-06",
             "tema": "Alternativ votering mellom innstillingen og forslagene 1 -  4 på vegne av SV, R, V, og KrF.",
             "vedtatt": True, "fri": False, "for": 80, "mot": 23, "verified": True,
             "excluded": None,
             "partier": {"A": [29, 0], "FrP": [12, 0], "H": [21, 1], "KrF": [0, 2],
                         "MDG": [0, 2], "R": [0, 5], "SV": [0, 8], "Sp": [17, 0],
                         "Uav": [1, 0], "V": [0, 5]}}
RAD_17718 = {"vid": 17718, "alt": 17719, "sak": 86275,
             "tittel": "Endringer i statsbudsjettet 2021 under Arbeids- og sosialdepartementet",
             "komite": None, "dato": "2021-10-28",
             "tema": "Alternativ votering mellom Prop 7 LS, stor bokstav B, romertall I,  kapittel 2541 post 70 og Forslag 1 på vegne av H og V.",
             "vedtatt": True, "fri": True, "for": 69, "mot": 28, "verified": True,
             "excluded": None,
             "partier": {"A": [27, 0], "FrP": [13, 0], "H": [0, 21], "KrF": [0, 1],
                         "MDG": [2, 0], "PF": [0, 1], "R": [4, 0], "SV": [8, 0],
                         "Sp": [15, 1], "V": [0, 4]}}
# Kopiert uendret fra data/computed/positions/2026-2027.json — vedtatt
# partiforslag i trontaledebatten (sak 200414, ingen fagkomité).
RAD_28553 = {"vid": 28553, "alt": None, "sak": 200414, "tittel": "Trontaledebatt",
             "komite": None, "dato": "2026-10-06",
             "tema": "Forslag nr. 13 på vegne av H.",
             "vedtatt": True, "fri": False, "for": 95, "mot": 6, "verified": True,
             "excluded": None,
             "partier": {"A": [31, 1], "FrP": [29, 0], "H": [14, 0], "KrF": [4, 0],
                         "MDG": [5, 0], "R": [5, 0], "SV": [0, 5], "Sp": [5, 0],
                         "V": [2, 0]}}


class TestForslagsstillerParsing(unittest.TestCase):
    """Fasiten her leses rett ut av teksten — ingen beregning."""

    def test_vanlige_partilister(self):
        self.assertEqual(gj.parse_parties("SV og R"), {"SV", "R"})
        self.assertEqual(gj.parse_parties("Sp, SV, R og MDG"), {"Sp", "SV", "R", "MDG"})
        self.assertEqual(gj.parse_parties("FrP"), {"FrP"})

    def test_utskrevne_partinavn_gjenkjennes(self):
        self.assertEqual(gj.parse_parties("Rødt"), {"R"})
        self.assertEqual(gj.parse_parties("Høyre og Kristelig Folkeparti"), {"H", "KrF"})

    def test_enkeltrepresentanter_gir_ingen_partier(self):
        """Forslag fra navngitte enkeltrepresentanter er ikke partiforslag
        og skal gi None (holdes utenfor, opplyst på metodesiden)."""
        self.assertIsNone(gj.parse_parties("FrP og uavhengig representant Ulf Leirstein"))
        self.assertIsNone(gj.parse_parties("presidentskapet"))


class TestVedtattLogikkMotHandverifiserteVoteringer(unittest.TestCase):
    def kjor(self, rader):
        """Kjør hele gjennomslag-beregningen på de gitte radene."""
        original = gj.COMPUTED
        try:
            with tempfile.TemporaryDirectory() as tmp:
                gj.COMPUTED = Path(tmp)
                (gj.COMPUTED / "positions").mkdir()
                (gj.COMPUTED / "positions" / "test.json").write_text(
                    json.dumps(rader, ensure_ascii=False))
                gj.main()
                return json.loads((gj.COMPUTED / "gjennomslag.json").read_text())["test"]
        finally:
            gj.COMPUTED = original

    def test_forslag_forkastet_selv_om_raden_sier_0_mot_94(self):
        """Votering 3381 (håndverifisert mot stortinget.no, se docstring):
        forslaget fra FrP, H og KrF ble FORKASTET — selv om API-raden er en
        ensidig 0–94. Fasit: fremmet for alle tre, vedtatt for ingen."""
        resultat = self.kjor([RAD_3381])
        self.assertEqual(resultat["FrP"], {"fremmet": 1, "vedtatt": 0})
        self.assertEqual(resultat["H"], {"fremmet": 1, "vedtatt": 0})
        self.assertEqual(resultat["KrF"], {"fremmet": 1, "vedtatt": 0})

    def test_vedtatt_flagget_alene_avgjor_ikke_alternativ_votering(self):
        """Votering 3541 (håndverifisert mot stortinget.no, se docstring):
        raden sier vedtatt=true, men det som ble vedtatt var INNSTILLINGEN —
        FrP (forslagsstiller) stemte mot og tapte 41–62. Fasit: FrP fremmet
        1, fikk vedtatt 0. En naiv lesning av vedtatt-flagget ville gitt 1."""
        resultat = self.kjor([RAD_3541])
        self.assertEqual(resultat["FrP"], {"fremmet": 1, "vedtatt": 0})

    def test_speiltvillingen_telles_ikke_i_gjennomslag(self):
        """Scenario: Den samme alternative voteringen som to speilrader — én
        tellende og én merket 'alternativ_speil' (slik analyse.py leverer
        dem). Fasit: FrP krediteres for ETT fremmet forslag, ikke to.
        (Tetter testhull påvist ved mutasjonstesting i den eksterne
        gjennomgangen.)"""
        speil = {**RAD_3541, "vid": 3542, "excluded": "alternativ_speil"}
        resultat = self.kjor([RAD_3541, speil])
        self.assertEqual(resultat["FrP"]["fremmet"], 1)

    def test_alternativ_votering_med_paa_vegne_av_bruker_forslagsstillernes_side(self):
        """Feil funnet november 2026: Alternative voteringer der
        forslagsstillerne står med «på vegne av» (ikke «fra») ble lest rett
        av vedtatt-flagget og talt som vedtatt, selv om forslaget falt.
        Fasit fra stortinget.no:
          25700 (sak 103154): «Representantforslaget ble ikke vedtatt» —
            innstillingen vant 80–23 over forslagene fra SV, R, V og KrF.
          17718 (sak 86275): referatet 28.10.2021: «forslaget i
            proposisjonen bifalt med 69 mot 28 stemmer» over forslaget fra
            Høyre og Venstre.
        Fasit: fremmet 1, vedtatt 0 for hver forslagsstiller."""
        resultat = self.kjor([RAD_25700])
        for parti in ("SV", "R", "V", "KrF"):
            self.assertEqual(resultat[parti], {"fremmet": 1, "vedtatt": 0}, parti)
        resultat = self.kjor([RAD_17718])
        for parti in ("H", "V"):
            self.assertEqual(resultat[parti], {"fremmet": 1, "vedtatt": 0}, parti)

    def test_ordinaert_partiforslag_teller_for_alle_forslagsstillerne(self):
        """Votering 24893: «Forslag nr. 12 på vegne av SV, R og MDG» falt
        14–86. Fasit: fremmet=1 for SV, R og MDG; vedtatt=0; ingen andre
        partier krediteres."""
        resultat = self.kjor([RAD_24893])
        for parti in ("SV", "R", "MDG"):
            self.assertEqual(resultat[parti], {"fremmet": 1, "vedtatt": 0})
        self.assertNotIn("A", resultat)


class TestTemaOgVedtatteForslag(unittest.TestCase):
    """De nye filene (november 2026): gjennomslag per fagkomité og listen over
    vedtatte forslag. Tre ekte rader:
      24893 (NÆRING)  SV, R og MDG — falt 14–86
      3541  (KOMMFORV) FrP — falt (innstillingen vant), se over
      28553 (ingen komité, trontaledebatten 2026) «Forslag nr. 13 på vegne
            av H.» — vedtatt 95–6
    Fasit: bare 28553 står i listen over vedtatte. Komitéfilen har NÆRING og
    KOMMFORV med vedtatt 0, og ingenting for H, fordi trontaledebatten ikke
    har noen fagkomité (den telles bare under «alle temaer»)."""

    def kjor(self, rader):
        original = gj.COMPUTED
        try:
            with tempfile.TemporaryDirectory() as tmp:
                gj.COMPUTED = Path(tmp)
                (gj.COMPUTED / "positions").mkdir()
                (gj.COMPUTED / "positions" / "test.json").write_text(
                    json.dumps(rader, ensure_ascii=False))
                with redirect_stdout(io.StringIO()):
                    gj.main()
                les = lambda navn: json.loads((gj.COMPUTED / navn).read_text())
                return (les("gjennomslag.json")["test"],
                        les("gjennomslag_komite.json")["test"],
                        les("gjennomslag_vedtatt.json"))
        finally:
            gj.COMPUTED = original

    def test_komite_og_liste(self):
        totalt, komite, vedtatte = self.kjor([RAD_24893, RAD_3541, RAD_28553])
        self.assertEqual([r["vid"] for r in vedtatte], [28553])
        self.assertEqual(vedtatte[0]["partier"], ["H"])
        self.assertEqual(set(komite), {"NÆRING", "KOMMFORV"})
        self.assertEqual(komite["NÆRING"]["SV"], {"fremmet": 1, "vedtatt": 0})
        self.assertEqual(komite["KOMMFORV"]["FrP"], {"fremmet": 1, "vedtatt": 0})
        self.assertEqual(totalt["H"], {"fremmet": 1, "vedtatt": 1})


if __name__ == "__main__":
    unittest.main()
