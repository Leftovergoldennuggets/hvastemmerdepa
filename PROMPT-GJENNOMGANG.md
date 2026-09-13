# Gjenbrukbar prompt: uavhengig gjennomgang av «Hva stemmer de på?»

Slik brukes den: åpne Claude Code (eller tilsvarende AI-verktøy) i prosjektmappen og
lim inn teksten under. Kjør den etter større endringer, eller et par ganger i året.
Gjennomgangen endrer ingenting — den bare leser, måler og rapporterer.

---

Du skal gjøre en uavhengig kvalitetsgjennomgang av dette prosjektet — en statisk
nettside (web/) og en Python-pipeline (pipeline/) som beregner hvor ofte partiene
på Stortinget stemmer likt, med daglig automatisk oppdatering via GitHub Actions
og publisering på Vercel. Største risiko er feil tall som blir misinformasjon.

Grunnprinsipper for hele gjennomgangen:

- Behandle ALLE kvalitetsdokumenter i repoet (AUDIT.md, KVALITETSKONTROLL.md,
  RAPPORT-KODEGJENNOMGANG.md m.fl.) som PÅSTANDER som skal etterprøves empirisk,
  ikke som fakta — de kan være skrevet av en AI, inkludert deg selv i en tidligere
  økt.
- Verifiser ved å KJØRE og MÅLE, ikke bare lese kode. Skill i rapporten klart
  mellom BEKREFTET (du reproduserte det selv) og SANNSYNLIG (bare lest).
- ENDRE INGENTING: ikke commit, ikke push, ikke publiser. Midlertidige endringer
  (f.eks. mutasjonstesting) skal reverseres, og `git status` skal være ren til
  slutt. Ikke kjør pipeline/fetch.py (tar timevis); maks ~15 kall mot
  data.stortinget.no (respekter grensen på 100 kall/min).

Gjør følgende, i denne rekkefølgen:

1. REPRODUKSJON (viktigst). Hent rådataene (last ned «raw-seed»-releasen fra
   GitHub-repoet hvis data/raw/ er tom: `gh release download raw-seed`). Kjør
   `python3 pipeline/analyse.py`, `analyse_gjennomslag.py`, `analyse_personer.py`
   og `publish.py`, og diff resultatet mot det som ligger publisert i
   web/public/data/. Alt skal reproduseres eksakt (avvik som skyldes at rådataene
   er eldre enn publiserte data skal identifiseres og forklares som nettopp det).
   Ethvert numerisk avvik som IKKE kan forklares med datoforskjell er et alvorlig
   funn.

2. STIKKPRØVER MOT FASIT. Velg 5 voteringer fra publiserte data (inkluder minst
   én alternativ votering og én fra nyeste sesjon), hent offisielle stemmetall
   fra data.stortinget.no, og kontroller at publiserte partitall stemmer.

3. TESTER OG MUTASJON. Kjør testsuiten (`python3 -m unittest discover -s
   pipeline/tests`). Gjør deretter en mutasjonstest: innfør 5–8 bevisste feil i
   beregningskoden én om gangen (bytt om stemmekoder, fjern en ekskludering,
   endre en terskel, forskyv en datogrense), kjør testene etter hver, og revertér.
   Rapporter hvilke feil testene IKKE fanget — det er hull i sikkerhetsnettet.

4. METODE VS. KODE. Sammenlign det web/src/MethodPage.jsx lover med det
   pipeline/analyse.py faktisk gjør (ekskluderinger, flertallsregler, håndtering
   av fravær og uavhengige). Ethvert avvik mellom metodebeskrivelse og kode er
   et funn, selv om koden isolert sett er «riktig». Kontroller også at tallene
   som står i løpende tekst på sidene (metodeside, gjennomslagsside) stemmer med
   datafilene.

5. AUTOMATIKKEN. Gå gjennom .github/workflows/oppdater.yml og pipeline-skriptene
   den kaller: kan noe steg publisere feil tall uten å feile? Sjekk spesielt
   check_update.py (hvilke filer vokter den — og hvilke ikke?) og
   valider_format.py (hvilke felt som brukes i analyse-koden valideres ikke?).
   Sjekk med `gh run list` at de siste kjøringene faktisk har vært grønne.

6. HOSTING OG LIVE-SIDEN. Mål med curl mot produksjonssiden (ikke anta —
   mål):
   - Cache: /data/*.json skal ha `cache-control` som tvinger revalidering
     (leserne skal aldri kunne se gamle tall etter en oppdatering); verifiser
     med If-None-Match at etag-revalidering svarer 304. JS-bundlen i /assets/
     bør derimot caches lenge (immutable).
   - Sikkerhetsheadere: sjekk at Content-Security-Policy,
     X-Content-Type-Options, Referrer-Policy, X-Frame-Options og HSTS er
     til stede (de settes i web/vercel.json — sjekk at filen fortsatt finnes
     og faktisk slår gjennom på live-siden).
   - Personvern: ingen Set-Cookie-headere, og ingen sporing/tredjepartskall
     i den bygde JS-bundlen (grep etter analytics/gtag/beacon/fetch mot
     fremmede domener). Dette er et løfte siden gir leserne — verifiser at
     det fortsatt holder.
   - Indeksering/deling: produksjonen skal IKKE ha X-Robots-Tag: noindex;
     sjekk at delingsmetadata (og:-tags, favicon) fortsatt finnes i
     web/index.html.
   - Deploy: bekreft at siste Vercel-deploy tilsvarer siste commit (sjekk
     last-modified/age-headere mot git-loggen).
   Bygg og lint frontenden lokalt (`cd web && npm install && npm run build
   && npm run lint`); rapporter feil og vesentlig endring i bundle-størrelse.

7. SIKKERHET. Konkret, ikke generelt:
   - Hemmeligheter: søk i hele repoet OG git-historikken etter nøkler,
     tokens og .env-filer (mønstre: api_key, secret, token, bearer, ghp_,
     sk-). Sjekk at .gitignore fortsatt dekker .env* og .vercel.
   - Avhengigheter: `npm audit` for web/; bekreft at pipelinen fortsatt kun
     bruker Pythons standardbibliotek (nye imports = nye avhengigheter som
     må vurderes). Sjekk at GitHub Actions-versjonene i workflowene er
     uendret/pinnet.
   - XSS: grep web/src etter dangerouslySetInnerHTML, innerHTML og eval —
     skal gi null treff. Sjekk at lenker bygget fra data fortsatt går til
     stortinget.no og bruker encodeURIComponent der parametre settes inn.
   - Tilganger: sjekk om .claude/settings.json (eller andre config-filer
     som gir verktøy tillatelser) er committet med brede regler.

8. HYGIENE. Sjekk at README-instruksjonene fortsatt stemmer med filene som
   finnes, at ENDRINGSLOGG.md er ajour, og at «raw-seed»-releasen på GitHub
   ikke er blitt urimelig gammel i forhold til dagens data.

Rapportér til slutt i én samlet oversikt, skrevet for et menneske uten
kodebakgrunn: (a) hovedkonklusjon først — kan tallene stoles på?, (b) funn
rangert som «må fikses» / «bør fikses» med en kort forklaring av KONSEKVENSEN
av hvert funn i klarspråk, (c) en ærlig liste over hva du IKKE fikk verifisert.
Ikke fiks noe uten å spørre først.
