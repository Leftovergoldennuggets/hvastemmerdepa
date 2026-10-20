"""refresh_current.py: filene for pågående sesjon slettes én gang hver.

Regresjonstest for krasjet i oktober 2026: saker som lever over sesjons-
skiftet står i begge sakslistene, så samme voteringsfil ble lagt i
slettelisten to ganger og andre forsøk feilet med FileNotFoundError.
"""
import datetime
import gzip
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import refresh_current  # noqa: E402


def _skriv_saker(raw, sesjon, sak_ids):
    f = raw / "saker" / f"{sesjon}.json.gz"
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_bytes(gzip.compress(json.dumps(
        {"saker_liste": [{"id": i} for i in sak_ids]}).encode()))


class TestSesjonsvalg(unittest.TestCase):
    def test_oktober_tar_med_forrige_sesjon(self):
        self.assertEqual(refresh_current.current_sessions(datetime.date(2026, 10, 20)),
                         ["2026-2027", "2025-2026"])

    def test_november_tar_bare_paagaaende_sesjon(self):
        self.assertEqual(refresh_current.current_sessions(datetime.date(2026, 11, 1)),
                         ["2026-2027"])

    def test_september_tilhoerer_sesjonen_som_startet_i_fjor(self):
        self.assertEqual(refresh_current.current_sessions(datetime.date(2026, 9, 30)),
                         ["2025-2026"])


class TestSlettingOverSesjonsskiftet(unittest.TestCase):
    def test_sak_i_begge_sesjoner_slettes_uten_krasj(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp)
            _skriv_saker(raw, "2025-2026", [100, 200])
            _skriv_saker(raw, "2026-2027", [200, 300])   # 200 lever over skiftet
            (raw / "voteringer").mkdir()
            for i in (100, 200, 300):
                (raw / "voteringer" / f"{i}.json.gz").write_bytes(b"x")

            gammel_raw = refresh_current.RAW
            gammel_argv = sys.argv
            try:
                refresh_current.RAW = raw
                sys.argv = ["refresh_current.py"]
                refresh_current.datetime.date = _FastDato   # 20. oktober 2026
                refresh_current.main()
            finally:
                refresh_current.RAW = gammel_raw
                sys.argv = gammel_argv
                refresh_current.datetime.date = datetime.date

            self.assertEqual(sorted(p.name for p in raw.rglob("*.json.gz")), [])


class _FastDato(datetime.date):
    @classmethod
    def today(cls):
        return cls(2026, 10, 20)


if __name__ == "__main__":
    unittest.main()
