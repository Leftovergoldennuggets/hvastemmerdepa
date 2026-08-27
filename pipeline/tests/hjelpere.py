"""Byggeklosser for testene: skriver et miniatyr-rådatalager på disk.

Testene lager små, fiktive voteringer der fasiten er selvinnlysende
(3 stemmer for og 2 mot = flertall for), skriver dem i nøyaktig samme
filformat som Stortingets API leverer, og kjører den EKTE analysekoden
(pipeline/analyse.py) på dem. Ingen beregningslogikk er kopiert hit —
testene tester selve koden som lager tallene på nettstedet.
"""
import datetime
import gzip
import json
from pathlib import Path

SESJON = "2099-2100"          # fiktiv sesjon, kan aldri kollidere med ekte
SAK_ID = 900001


def dato_ms(iso_dato):
    """'2099-11-15' -> API-ets datoformat '/Date(<millisekunder>)/' (kl. 12 UTC,
    midt på dagen, så datoen er entydig uansett tidssone)."""
    d = datetime.datetime.fromisoformat(iso_dato + "T12:00:00+00:00")
    return f"/Date({int(d.timestamp() * 1000)}+0200)/"


def stemme(rep_id, parti, kode, vara=False):
    """Én enkeltstemme slik API-et leverer den. kode: 1=ikke til stede,
    2=for, 3=mot. parti=None gir uavhengig representant."""
    return {
        "votering": kode,
        "fast_vara_for": None,
        "vara_for": None,
        "representant": {
            "id": rep_id,
            "parti": {"id": parti} if parti else None,
            "vara_representant": vara,
        },
    }


def votering(vid, dato, antall_for, antall_mot, vedtatt, tema="Testforslag",
             alt=-1, resultat_type=0):
    """Én votering slik API-et leverer den (feltene analyse.py leser)."""
    return {
        "votering_id": vid,
        "votering_tid": dato_ms(dato),
        "antall_for": antall_for,
        "antall_mot": antall_mot,
        "antall_ikke_tilstede": 0,
        "vedtatt": vedtatt,
        "votering_tema": tema,
        "fri_votering": False,
        "alternativ_votering_id": alt,
        "votering_resultat_type": resultat_type,
    }


def skriv_lager(katalog, voteringer, stemmer_per_votering, partier=("A", "H", "SV", "Sp", "FrP")):
    """Skriv et komplett miniatyr-rådatalager: én sesjon, én sak, gitte
    voteringer og enkeltstemmer. Returnerer katalogen (som analyse.RAW
    settes til i testen).

    stemmer_per_votering: {votering_id: [stemme(...), ...]}. En votering som
    IKKE har noen oppføring får ingen stemmefil (slik API-et oppfører seg for
    voteringer uten individdata).
    """
    raw = Path(katalog)

    def gz(relativ_sti, innhold):
        p = raw / relativ_sti
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(gzip.compress(json.dumps(innhold).encode()))

    gz("sesjoner.json.gz", {"sesjoner_liste": [
        {"id": SESJON, "fra": dato_ms("2099-10-01"), "til": dato_ms("2100-09-30")}]})
    gz(f"partier/{SESJON}.json.gz", {"partier_liste": [
        {"id": p, "navn": f"Testparti {p}"} for p in partier]})
    gz(f"saker/{SESJON}.json.gz", {"saker_liste": [
        {"id": SAK_ID, "korttittel": "Testsak", "komite": {"id": "TESTKOM"}}]})
    gz(f"voteringer/{SAK_ID}.json.gz", {"sak_votering_liste": voteringer})
    for vid, stemmer in stemmer_per_votering.items():
        gz(f"stemmer/{vid}.json.gz", {"voteringsresultat_liste": stemmer})
    return raw
