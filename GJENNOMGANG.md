# Guide for kodegjennomgang

Denne guiden er skrevet for deg som skal gjøre en uavhengig gjennomgang av
prosjektet før lansering. Den prioriterer tiden din: hva som må leses nøye,
hva som trygt kan hoppes over, og hvilke påstander som bør etterprøves.

## Hva gjennomgangen skal beskytte mot

Nettstedet publiserer statistikk om hvordan partiene på Stortinget stemmer.
Risikoen er **metodefeil som blir til misinformasjon** — tall som er gale,
skjevt utvalg, eller beregninger som ikke gjør det metodesiden sier.

Det er *ikke* en sikkerhets- eller kodestilgjennomgang: siden er 100 % statisk
(ingen backend, ingen brukerdata, ingen innlogging), så spørsmålet er utelukkende
«regner koden riktig, og er det den regner ærlig beskrevet?»

## Dataflyt (hele arkitekturen i fire linjer)

```
Stortingets API  →  data/raw/          (rådata lagret uendret, gzip — fetch.py)
data/raw/        →  data/computed/     (posisjoner, enighetsmatriser — analyse.py m.fl.)
data/computed/   →  web/public/data/   (ren kopiering + metadata — publish.py)
web/             →  statisk nettside   (React; leser JSON, regner ikke selv)
```

## Prioritert lesesti (90 minutter)

| Tid | Fil | Hva du ser etter |
|---|---|---|
| 5 min | `README.md` + denne | Oversikt |
| 30 min | `pipeline/analyse.py` (308 linjer) | **Kjernen.** Partistandpunkt (flertall blant de som stemte; likt = «delt»), parvis enighet, ekskluderinger (lovteknisk / speiltvilling / manglende data), verifisering mot offisielle stemmetall, sesjonsgrenser, regjeringsperioder |
| 15 min | `pipeline/analyse_gjennomslag.py` (133 linjer) | Parsing av forslagsstillere fra beskrivelsestekst; vedtatt-logikken for alternativ votering |
| 10 min | `pipeline/fetch.py` (154 linjer) | At rådata lagres uendret og komplett, og at «recorded»-utvalget (antall_for ≥ 0) er riktig |
| 10 min | `web/src/lib.js` (174 linjer) | At frontenden bare summerer pipelinens tall og deler for prosent — ingen egen beregning |
| 15 min | Stikkprøver (under) | At tallene stemmer med virkeligheten |
| 5 min | Buffer / notater | |

**Verdt et blikk hvis tiden strekker til:** `pipeline/publish.py` — den
beregner faktapåstandene metodesiden viser (samholds-prosent, avvikslister,
andelen voteringer der alle partier sto på samme side).

**Kan trygt hoppes over:** resten av `web/src/` (~2 600 linjer JSX er ren
visning — feil der gir synlig feil graf, ikke stille metodefeil), all CSS,
`pipeline/fetch_fotos.py`, `pipeline/build_kart.py` (salkart-geometri),
`pipeline/fetch_personer.py` / `analyse_personer.py` (representant-sidene —
samme mønstre som analyse.py), `pipeline/refresh_current.py` /
`check_update.py` / `valider_format.py` / `.github/workflows/oppdater.yml`
(orkestrering og vakthold for den daglige auto-oppdateringen — ingen
beregninger skjer der).

## Nøkkelinvarianter — påstandene alt hviler på

1. **Stemmekoder:** 1 = ikke til stede, 2 = for, 3 = mot. To uavhengige
   bevis: (a) summen av individstemmer reproduserer offisielle
   antall_for/antall_mot for 19 605 av 19 620 voteringer (avvikene er
   opplyst på metodesiden), og (b) Stortingets XML-eksport bruker navngitte
   verdier («for»/«mot»/«ikke_tilstede») for samme data — kjør
   `python3 pipeline/sjekk_json_mot_xml.py` for å se mappingen bevist
   direkte fra API-et (JSON-formatet er ellers udokumentert hos Stortinget;
   XML-feltene er dokumentert, og skriptet viser at JSON speiler dem).
2. **Partistandpunkt** = flertallet blant partiets representanter som faktisk
   stemte; nøyaktig likt = «delt» (telles ikke). Uavhengige («Uav») holdes
   utenfor all partistatistikk.
3. **Én beslutning telles én gang:** en «alternativ votering» eksporteres av
   API-et som to speilvendte rader; tvillingen med høyest id ekskluderes
   (`excluded: "alternativ_speil"`). Sjekk at logikken i analyse.py faktisk
   gjør dette.
4. **Ekskluderinger flagges, slettes ikke:** lovtekniske voteringer og
   speiltvillinger ligger igjen i positions/ med excluded-felt, for sporbarhet.
5. **Parti ved stemmetidspunkt:** representanter som bytter parti telles for
   partiet de tilhørte da de stemte; vararepresentanter for sitt eget parti.
6. **Frontenden regner ikke:** `web/src/lib.js` er eneste fil med aritmetikk,
   og den bare summerer par-tellinger over sesjoner og deler agree/total.

## Kjøre ting selv

- **Nettstedet:** `cd web && npm install && npm run dev` — de beregnede dataene
  ligger i git (`web/public/data/`), så dette virker umiddelbart.
- **Re-kjøre analysen:** krever rådata, som ikke ligger i git (223 MB; full
  nedlasting tar ~7 timer pga. API-grensen). For å etterprøve én sesjon:

  ```bash
  mkdir -p data/raw && curl -s 'https://data.stortinget.no/eksport/sesjoner?format=json' \
    | gzip > data/raw/sesjoner.json.gz   # sesjonslista (hentes ellers bare av full kjøring)
  python3 pipeline/fetch.py 2023-2024    # ~40 min — start den først, les kode imens
  python3 pipeline/analyse.py 2023-2024
  ```

  Sammenlign så utskriften og `data/computed/` med tallene som ligger i git.
  Alternativt kan Anders sende deg en zip av `data/raw/` (223 MB).

## Stikkprøver (velg 2–3)

1. **Én votering ende til ende:** velg en votering på nettstedet → følg lenken
   til stortinget.no → sammenlign for/mot-tall og partifordeling.
2. **Én matrisecelle:** last ned par-CSV-en for f.eks. Ap×Høyre i én sesjon;
   sjekk at rader ÷ enigheter gir prosenten i matrisen.
3. **Politisk kjente fakta:** H×FrP bør ligge nær toppen 2013–2020; A×Sp høyt
   2021–2025; R×FrP bør være det laveste paret.
4. **Replikasjonstesten (grundigst):** les kun metodesiden på nettstedet og
   API-dokumentasjonen, og beregn Ap×H-prosenten for én sesjon fra bunnen. Får
   du et annet tall, er enten koden eller metodesiden feil.

## Allerede gjort — så du slipper å gjenoppdage det

`AUDIT.md` dokumenterer en grundig kvalitetskontroll fra juli 2026:

- **Seksjon D**: liste over det som allerede er empirisk verifisert (fint
  utgangspunkt for å velge hva *du* vil etterprøve uavhengig).
- **Seksjon A/B**: funnene som ble rettet (dobbeltelling av alternative
  voteringer m.m.) — med status og målt effekt.
- **Seksjon G**: kjente åpne spørsmål som ligger hos Stortinget (bl.a. 12
  voteringer med tomme individdata og den stille 2013–14-sesjonen). Disse er
  opplyst på metodesiden og er ikke noe gjennomgangen trenger å løse.
- `ENDRINGSLOGG.md` er audit-trail for alle metodiske endringer.

Eksterne fasiter: Sikt/NSDs Voteringsarkiv (polsys.sikt.no) og Holder de ords
åpne kildekode (github.com/holderdeord) — begge er brukt til kryssjekk før,
se AUDIT.md seksjon E.

## Leveranse

Det mest verdifulle du kan si etterpå er:

1. Gjør `analyse.py` det metodesiden (og docstringen) sier — eller fant du
   avvik mellom beskrivelse og kode?
2. Fant du utvalgs- eller beregningsfeil som kan gi misvisende tall?
3. Var det noe du *ikke* rakk å vurdere (så det kan sies ærlig)?
