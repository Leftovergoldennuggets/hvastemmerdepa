"""Download representatives per stortingsperiode plus each person's coded
biography (education, occupation, parliamentary history — kodetbiografi).

Reuses fetch.py's paced, resumable download machinery; ~600 calls total,
well within the ordinary API limit. Resumable like everything else:
a file on disk means done.
"""
import json
import sys
import urllib.parse

from fetch import BASE, RAW, fetch_to

FIRST_PERIOD_YEAR = 2009  # covers all sessions with voting data (from 2011)


def main():
    data = fetch_to(RAW / "stortingsperioder.json.gz",
                    f"{BASE}/stortingsperioder?format=json")
    periods = [p["id"] for p in json.loads(data)["stortingsperioder_liste"]
               if int(p["id"][:4]) >= FIRST_PERIOD_YEAR]
    print(f"{len(periods)} perioder: {periods}", flush=True)

    person_ids = set()
    for periode in sorted(periods):
        raw = fetch_to(RAW / "representanter" / f"{periode}.json.gz",
                       f"{BASE}/representanter?stortingsperiodeid={periode}&format=json")
        reps = json.loads(raw)["representanter_liste"]
        person_ids.update(r["id"] for r in reps)
        print(f"[{periode}] {len(reps)} representanter", flush=True)

    for i, pid in enumerate(sorted(person_ids)):
        fetch_to(RAW / "biografi" / f"{pid}.json.gz",
                 f"{BASE}/kodetbiografi?personid={urllib.parse.quote(pid)}&format=json")
        if (i + 1) % 100 == 0:
            print(f"biografier {i+1}/{len(person_ids)}", flush=True)

    print(f"DONE: {len(person_ids)} biografier", flush=True)


if __name__ == "__main__":
    main()
