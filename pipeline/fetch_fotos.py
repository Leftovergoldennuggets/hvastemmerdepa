"""Download official portraits for every representative we track.

Hotlinking Stortinget's personbilde endpoint from visitors' browsers does not
work at scale — the endpoint is rate-limited (HTTP 429), so a page with many
photos gets broken images. Instead the pipeline downloads each portrait once
(paced, resumable like everything else) and the site serves them itself.

Size "middels" (158x211 px) matches the site's display sizes. Photos are
Stortinget's own, delivered via the open data service; the site credits
"Foto: Stortinget" wherever they are shown.

Output: data/raw/fotos/<personid>.jpg
"""
import gzip
import json
import urllib.parse
from pathlib import Path

from fetch import BASE, RAW, _paced_fetch


def main():
    person_ids = set()
    for p in sorted((RAW / "representanter").glob("*.json.gz")):
        reps = json.loads(gzip.decompress(p.read_bytes()))["representanter_liste"]
        person_ids.update(r["id"] for r in reps if not r.get("vara_representant"))

    out_dir = RAW / "fotos"
    out_dir.mkdir(parents=True, exist_ok=True)
    done = missing = 0
    for i, pid in enumerate(sorted(person_ids)):
        path = out_dir / f"{pid}.jpg"
        if path.exists():
            done += 1
            continue
        try:
            data = _paced_fetch(
                f"{BASE}/personbilde?personid={urllib.parse.quote(pid)}&storrelse=middels"
            )
        except Exception as e:
            print(f"  {pid}: FAILED ({e})", flush=True)
            missing += 1
            continue
        if not data.startswith(b"\xff\xd8"):  # not a JPEG: error page etc.
            print(f"  {pid}: no photo (got {data[:30]!r})", flush=True)
            missing += 1
            continue
        tmp = path.with_suffix(".tmp")
        tmp.write_bytes(data)
        tmp.rename(path)
        done += 1
        if (i + 1) % 50 == 0:
            print(f"fotos {i+1}/{len(person_ids)}", flush=True)

    print(f"DONE: {done} fotos, {missing} mangler", flush=True)


if __name__ == "__main__":
    main()
