# Hva stemmer de?

[![Tester](https://github.com/Leftovergoldennuggets/hvastemmerdepa/actions/workflows/test.yml/badge.svg)](https://github.com/Leftovergoldennuggets/hvastemmerdepa/actions/workflows/test.yml)
[![Daglig dataoppdatering](https://github.com/Leftovergoldennuggets/hvastemmerdepa/actions/workflows/oppdater.yml/badge.svg)](https://github.com/Leftovergoldennuggets/hvastemmerdepa/actions/workflows/oppdater.yml)

**Nettstedet:** [hvastemmerdepa.vercel.app](https://hvastemmerdepa.vercel.app)

Uavhengig, ikke-kommersielt samfunnsprosjekt som viser hvor ofte partiene på
Stortinget stemmer likt – basert på alle registrerte voteringer siden oktober
2011, hentet fra [Stortingets tjeneste for åpne data](https://data.stortinget.no)
(NLOD-lisens; Stortinget er kilde).

Alt er etterprøvbart: rådata lastes ned uendret, hver beregning kontrollsummeres
mot Stortingets offisielle stemmetall, og hver votering på nettstedet lenker til
saken hos stortinget.no. Metoden er dokumentert på nettstedets metodeside.

**Kvalitetsdokumentasjon:** [KVALITETSKONTROLL.md](KVALITETSKONTROLL.md)
(metodevalg, kontrollhistorikk og hvordan alt etterprøves) ·
[AUDIT.md](AUDIT.md) (full revisjon, juli 2026) ·
[RAPPORT-KODEGJENNOMGANG.md](RAPPORT-KODEGJENNOMGANG.md) (uavhengig gjennomgang,
aug. 2026: «tallene er riktige», byte-identisk reproduksjon fra rådata) ·
[ENDRINGSLOGG.md](ENDRINGSLOGG.md) (alle metodeendringer) ·
[GJENNOMGANG.md](GJENNOMGANG.md) (lesesti for kodegjennomgang).
Tester: `python3 -m unittest discover -s pipeline/tests`

## Struktur

```
pipeline/fetch.py     Laster ned alle rådata (gjenopptakbar; respekterer
                      API-grensen på 100 kall/min – FETCH_RATE=900 med fritak)
pipeline/analyse.py   Beregner partistandpunkter, enighetsmatriser og
                      regjeringsperiode-tall, med verifisering mot offisielle
                      stemmetall
pipeline/publish.py   Kopierer beregnede data + metadata inn i nettstedet
web/                  Nettstedet (React + Vite, ingen backend – ren statisk side)
.github/workflows/    Daglig auto-oppdatering: delta-henting, omregning,
                      fornuftssjekk (pipeline/check_update.py) og publisering
data/raw/             Rådata fra API-et (gjenskapes med fetch.py; ikke i git)
data/computed/        Beregnede data (gjenskapes med analyse.py)
```

## Kjør alt fra bunnen

```bash
python3 pipeline/fetch.py      # ~7 timer innenfor API-grensen (én gang)
python3 pipeline/analyse.py
python3 pipeline/publish.py
cd web && npm install && npm run dev
```

Voteringskoder i API-et (verifisert mot offisielle stemmetall):
`1 = ikke til stede, 2 = for, 3 = mot`.

## Kilder og lisens

- Kode: [MIT-lisens](LICENSE) – bruk, lær og bygg videre fritt, med kreditering
- Rådata: Stortingets tjeneste for åpne data, [NLOD](https://data.norge.no/nlod/no/2.0)
  (Stortinget er kilde)
- Beregnede data: fri gjenbruk til nyhetssaker, undervisning, forskning m.m. –
  krediter Stortinget (rådata) og dette prosjektet (beregningene)
- Regjeringsperioder: regjeringen.no / Wikipedia (datoer i `pipeline/regjeringer.json`)
- Partilogoer: offisielle merker via Wikimedia Commons, brukt redaksjonelt
