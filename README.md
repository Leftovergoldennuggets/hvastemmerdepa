# Hva stemmer de?

Uavhengig, ikke-kommersielt samfunnsprosjekt som viser hvor ofte partiene på
Stortinget stemmer likt – basert på alle registrerte voteringer siden oktober
2011, hentet fra [Stortingets tjeneste for åpne data](https://data.stortinget.no)
(NLOD-lisens; Stortinget er kilde).

Alt er etterprøvbart: rådata lastes ned uendret, hver beregning kontrollsummeres
mot Stortingets offisielle stemmetall, og hver votering på nettstedet lenker til
saken hos stortinget.no. Metoden er dokumentert på nettstedets metodeside.

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

- Data: Stortingets tjeneste for åpne data, [NLOD](https://data.norge.no/nlod/no/2.0)
- Regjeringsperioder: regjeringen.no / Wikipedia (datoer i `pipeline/analyse.py`)
- Partilogoer: offisielle merker via Wikimedia Commons, brukt redaksjonelt
