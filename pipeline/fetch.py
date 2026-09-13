"""Download the complete voting history from Stortinget's open data API.

Fetches, for every session from 2011-2012 (first with electronic voting data)
to the present: the party list, all cases (saker), all votes (voteringer) per
case, and individual representative votes (voteringsresultat) for every vote
taken with the electronic voting system (antall_for >= 0; votes adopted by
acclamation have no individual data to fetch).

Raw API responses are stored untouched (gzipped) under data/raw/ so every
downstream number can be traced back to, and re-verified against, the source.
A file on disk means "already fetched" — the script can be stopped and
restarted at any time and resumes where it left off.

Respects the official limit of 100 API calls/minute (https://data.stortinget.no
-> Bruksvilkår). On HTTP 429 it backs off and retries. Data license: NLOD;
Stortinget must be credited as the source.

Usage:  python3 pipeline/fetch.py            # fetch everything missing
        python3 pipeline/fetch.py 2023-2024  # fetch only the given session(s)
"""

import gzip
import json
import os
import re
import sys
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

# Stortinget documents the XML export; ?format=json returns the same data
# with the same field names — proven field-for-field by sjekk_json_mot_xml.py
# and guarded daily by valider_format.py.
BASE = "https://data.stortinget.no/eksport"
RAW = Path(__file__).resolve().parent.parent / "data" / "raw"
FIRST_SESSION_YEAR = 2011  # electronic per-representative voting starts 2011-2012

# Official limit is 100 calls/min; we pace request starts to stay safely
# under. Stortinget's IT department can whitelist an IP on request
# (web@stortinget.no) — with such an exemption, run e.g.:
#   FETCH_RATE=900 python3 pipeline/fetch.py
RATE_PER_MIN = float(os.environ.get("FETCH_RATE", "95"))
MIN_INTERVAL = 60 / RATE_PER_MIN
WORKERS = 3 if RATE_PER_MIN <= 100 else 8

_pace_lock = threading.Lock()
_last_start = [0.0]


def _paced_fetch(url, timeout=60, retries=5):
    """GET url, pacing all threads to respect the API rate limit."""
    for attempt in range(retries):
        with _pace_lock:
            wait = _last_start[0] + MIN_INTERVAL - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            _last_start[0] = time.monotonic()
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "stortingsvotering-prosjekt (åpent samfunnsprosjekt; "
                              "kontakt: leftovergoldennuggets@gmail.com)"
            })
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print(f"  429 rate-limited, backing off 65s ({url})", flush=True)
                time.sleep(65)
            elif attempt == retries - 1:
                raise
            else:
                time.sleep(5 * (attempt + 1))
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"gave up on {url}")


def fetch_to(path: Path, url: str) -> bytes:
    """Fetch url into gzipped path unless already present; return content."""
    if path.exists():
        return gzip.decompress(path.read_bytes())
    data = _paced_fetch(url)
    json.loads(data)  # refuse to store non-JSON (error pages etc.)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(gzip.compress(data))
    tmp.rename(path)  # atomic: no half-written files if interrupted
    return data


def active_sessions():
    """Session ids from 2011-2012 up to the newest session that has begun."""
    data = fetch_to(RAW / "sesjoner.json.gz", f"{BASE}/sesjoner?format=json")
    now_ms = time.time() * 1000
    out = []
    for s in json.loads(data)["sesjoner_liste"]:
        year = int(s["id"][:4])
        started = float(re.search(r"-?\d+", s["fra"]).group()) <= now_ms
        if year >= FIRST_SESSION_YEAR and started:
            out.append(s["id"])
    return sorted(out)


def fetch_session(sesjon: str):
    t0 = time.time()
    fetch_to(RAW / "partier" / f"{sesjon}.json.gz",
             f"{BASE}/partier?sesjonid={sesjon}&format=json")
    saker_raw = fetch_to(RAW / "saker" / f"{sesjon}.json.gz",
                         f"{BASE}/saker?sesjonid={sesjon}&format=json")
    sak_ids = sorted({s["id"] for s in json.loads(saker_raw)["saker_liste"]})
    print(f"[{sesjon}] {len(sak_ids)} saker", flush=True)

    # Saker can span sessions, so voteringer/ is shared storage: a sak already
    # fetched for an earlier session is skipped by fetch_to automatically.
    def _sak(sid):
        return json.loads(fetch_to(RAW / "voteringer" / f"{sid}.json.gz",
                                   f"{BASE}/voteringer?sakid={sid}&format=json"))

    recorded = []
    with ThreadPoolExecutor(WORKERS) as ex:
        for i, d in enumerate(ex.map(_sak, sak_ids)):
            for v in d.get("sak_votering_liste") or []:
                if v.get("antall_for", -1) >= 0 and v.get("antall_mot", -1) >= 0:
                    recorded.append(v["votering_id"])
            if (i + 1) % 200 == 0:
                print(f"[{sesjon}] voteringer {i+1}/{len(sak_ids)}", flush=True)

    recorded = sorted(set(recorded))
    print(f"[{sesjon}] {len(recorded)} recorded voteringer", flush=True)

    def _stemmer(vid):
        fetch_to(RAW / "stemmer" / f"{vid}.json.gz",
                 f"{BASE}/voteringsresultat?voteringid={vid}&format=json")

    with ThreadPoolExecutor(WORKERS) as ex:
        for i, _ in enumerate(ex.map(_stemmer, recorded)):
            if (i + 1) % 500 == 0:
                print(f"[{sesjon}] stemmer {i+1}/{len(recorded)}", flush=True)

    print(f"[{sesjon}] done in {(time.time()-t0)/60:.1f} min", flush=True)


def main():
    fetch_to(RAW / "allekomiteer.json.gz", f"{BASE}/allekomiteer?format=json")
    sessions = sys.argv[1:] or active_sessions()
    print(f"Fetching {len(sessions)} sessions: {sessions[0]} .. {sessions[-1]}", flush=True)
    for sesjon in sessions:
        fetch_session(sesjon)
    print("ALL DONE", flush=True)


if __name__ == "__main__":
    main()
