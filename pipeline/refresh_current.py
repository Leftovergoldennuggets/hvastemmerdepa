"""Delete the MUTABLE raw files for the ongoing session so fetch.py refetches them.

fetch.py's resume model treats "file on disk" as "done" — correct for immutable
data (individual votes never change once cast), but the LIST files for the
ongoing session keep growing: new saker are added, and open saker get new
voteringer. This script deletes exactly those list files; running fetch.py
afterwards downloads fresh copies plus anything new they reveal. Nothing else
is touched — stemmer/, biografi/ and fotos/ are immutable or append-only.

Deleted (for the newest started session, plus the previous one during October
so late-September votes are never missed across the session rollover):
  sesjoner.json.gz, stortingsperioder.json.gz   (tiny index files)
  partier/<sesjon>.json.gz, saker/<sesjon>.json.gz
  voteringer/<sakid>.json.gz for every sak in the session's (old) saker list
  representanter/<inneværende periode>.json.gz  (new vara can appear)

Usage:  python3 pipeline/refresh_current.py            # delete
        python3 pipeline/refresh_current.py --dry-run  # only print
"""
import datetime
import gzip
import json
import sys
from pathlib import Path

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"


def current_sessions(today: datetime.date):
    """Ongoing session id(s). Sessions run 1 Oct – 30 Sep; during October we
    also refresh the just-ended session to catch its final days' votes."""
    start_year = today.year if today.month >= 10 else today.year - 1
    ids = [f"{start_year}-{start_year + 1}"]
    if today.month == 10:
        ids.append(f"{start_year - 1}-{start_year}")
    return ids


def current_period(today: datetime.date):
    """Stortingsperiode id (elections every 4th year: 2009, 2013, ...)."""
    start_year = today.year if today.month >= 10 else today.year - 1
    p = start_year - ((start_year - 2009) % 4)
    return f"{p}-{p + 4}"


def main():
    dry = "--dry-run" in sys.argv
    today = datetime.date.today()

    targets = [RAW / "sesjoner.json.gz", RAW / "stortingsperioder.json.gz",
               RAW / "representanter" / f"{current_period(today)}.json.gz"]
    for sesjon in current_sessions(today):
        saker_file = RAW / "saker" / f"{sesjon}.json.gz"
        if saker_file.exists():
            saker = json.loads(gzip.decompress(saker_file.read_bytes()))["saker_liste"]
            targets += [RAW / "voteringer" / f"{s['id']}.json.gz" for s in saker]
        targets += [saker_file, RAW / "partier" / f"{sesjon}.json.gz"]

    existing = [t for t in targets if t.exists()]
    print(f"refresh_current: {len(existing)} files to refetch "
          f"(sessions {current_sessions(today)}, periode {current_period(today)})"
          f"{' [DRY RUN]' if dry else ''}")
    for t in existing:
        if dry:
            print(f"  would delete {t.relative_to(RAW)}")
        else:
            t.unlink()


if __name__ == "__main__":
    main()
