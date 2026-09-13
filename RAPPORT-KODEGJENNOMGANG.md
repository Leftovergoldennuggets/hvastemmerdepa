# Uavhengig kodegjennomgang — «Hva stemmer de på?»

**Utført:** 31. august 2026. **Omfang:** beregningslogikk, datapipeline, automatikk (GitHub Actions), frontend, hosting (Vercel), jus/lisenser og teknisk kvalitet. Alle påstander i prosjektets egne kvalitetsdokumenter er behandlet som påstander og etterprøvd empirisk — ikke tatt for gitt.

---

## Hovedkonklusjon

**Tallene på nettstedet er riktige.** Hele pipelinen ble kjørt på nytt fra rådata (223 MB, alle 19 620 voteringer): resultatet ble byte-identisk med det som er publisert. Syv voteringer ble i tillegg stikkprøvd direkte mot Stortingets API — alle stemte. Det er ingen avvik mellom det koden regner og det metodesiden lover, testene er reelle (fasit håndverifisert mot stortinget.no, ikke sirkulære), og de fanget 7 av 10 bevisst innførte feil i en mutasjonstest.

Risikoen ligger ikke i dagens tall, men i **fremtidig drift**: automatikken som oppdaterer siden hver natt kan feile stille, og sikkerhetsnettene har hull nøyaktig der mutasjonstesten viste at feil ville sluppet gjennom.

Prosjektet er uvanlig solid for et AI-assistert soloprosjekt: ingen hemmeligheter i git-historikken, null kjente sårbarheter i avhengighetene, minimal avhengighetsflate, ingen XSS-flater, forbilledlig NLOD-attribusjon og null sporing av leserne.

---

## Verifisert empirisk

- Full re-kjøring av pipelinen fra rådata → byte-identisk med publiserte tall.
- Alle 15 enighetsmatriser reprodusert eksakt; 7/7 API-stikkprøver mot Stortinget stemte.
- Alle 1 298 ekskluderinger av alternative voteringer verifisert (hver har korrekt speiltvilling).
- Stemmekodefordelingen (3,3 mill. enkeltstemmer, kun koder 1/2/3), quorum-sjekken (minimum nøyaktig 85, ingen under) og selvverifiseringen (19 605/19 620, de 3 mismatchene ligger hos kilden) bekreftet.
- Før/etter-tallene for speil-fiksen (748→676 splits, median 0,28 pp) reprodusert eksakt.
- Cache- og deploy-oppsettet på Vercel målt med curl: lesere kan ikke få gamle tall, deploys er atomiske.

**2013–14-anomalien er løst.** Den lave voteringsaktiviteten (284 registrerte) er reell parlamentarisk adferd, ikke datahull: voterings-ID-sekvensen hos Stortinget er sammenhengende gjennom de stille månedene, dagens API gir identiske tall, og – avgjørende – Dagsavisen/Holder de ord målte i august 2014 «282 voteringer» og samme oppmøteprosent i sanntid ([artikkel](https://www.dagsavisen.no/nyheter/innenriks/2014/08/05/skulker-naer-en-av-to-voteringer-pa-stortinget/)). Anbefaling: siter denne på metodesiden i stedet for den udokumenterte Sikt-kryssjekken.

---

## Må fikses (før videre promotering)

1. **Vær obs på varslingen ved feilet nattjobb.** GitHub sender som standard e-post når cron-jobben feiler, så noe varsling finnes — men bare til én person (den som sist endret cron-linjen), og bare hvis e-postvarsler er slått på. På selve nettsiden synes ikke en død jobb: «sist oppdatert» endres bare når det kommer nye data, så en feilende jobb ser ut som en stille periode. Én feilet natt er ufarlig. Sjekk at e-postvarslene faktisk står på; et `if: failure()`-steg som oppretter et GitHub-issue (~5 linjer) er billig ekstra sikkerhet.
2. **Fornuftssjekken (`check_update.py`) vokter bare én av åtte filtyper.** Hver natt regnes alle tall på nytt og de gamle filene overskrives — det finnes ingen «behold gårsdagens tall hvis de nye ser rare ut»-logikk utover denne sjekken, og den ser bare på voteringsantallet per sesjon. Skulle en fremtidig endring (hos Stortingets API eller i egen kode) gjøre enighetstallene tomme eller meningsløse, ville de overskrive de riktige tallene og publiseres automatisk uten at noe stopper det. Anbefaling: utvid sjekken med tre kontroller — partilisten er uendret, alle prosenter ligger mellom 0 og 100, ingen matrise er tom.
3. **Tre testhull (påvist ved mutasjonstest).** Vi la med vilje inn ti feil i beregningskoden, én om gangen, for å se om testene slo alarm. Sju ble fanget; tre slapp gjennom: feil i regjeringsperiode-tallene, dobbelttelling av alternative voteringer i gjennomslag, og feil ved sesjonsgrensedatoer. Ingen av disse er feil i dag — men testene er det som skal stoppe en fremtidig endring (typisk gjort med AI-hjelp) fra å innføre dem, og fornuftssjekken i punkt 2 ville heller ikke fanget dem. For akkurat disse tre feiltypene står det altså i dag ingenting mellom en fremtidig tastefeil og nettsiden. Tre nye tester tetter hullene.
4. **UTC-datofeil i `analyse.py` (`date_of`):** en votering etter midnatt norsk tid dateres én dag for tidlig — kan gi feil sesjons-/regjeringstilordning ved grensedatoer. Liten fiks.
5. **Rot-fetchen i frontenden mangler feilhåndtering** (`App.jsx:222`): feiler lastingen av `sessions.json`, viser hele siden «Laster data …» for evig, uten feilmelding.
6. **To faktafeil på metodesiden:** «19 617 av 19 620 stemmer eksakt» — riktig tall er 19 605 (12 kan ikke verifiseres i det hele tatt). Og 2013–14 bør omtales der (se over). I tillegg: AUDIT.md/KVALITETSKONTROLL.md skriver «2,3 mill. enkeltstemmer» — riktig er 3,3 mill. (sifferfeil).

## Bør fikses etter hvert

**Korrekthet og frontend**
- Stale-state-bug i voteringslisten: direkte URL-navigasjon mellom to par-sider kan vise forrige pars stemmer med nye partinavn (`PairView.jsx:303–334`).
- De to stedene frontenden dupliserer pipelinelogikk divergerer begge: `stance()` mangler ekskluderingen av uavhengige, og «Hele Stortinget»-raden på personsiden regnes med feil vekting. La pipelinen levere tallene.
- Voteringer hentet før Stortinget har registrert enkeltstemmene lagres som tomme filer og forblir permanent ekskludert; biografier oppdateres aldri etter første henting. En periodisk re-fetch av «pending»-filer løser begge.
- Periode- og temavalg ligger ikke i URL-en — delte lenker viser alltid standardvisningen.
- Salkartet og norgeskartet kan ikke betjenes med tastatur.
- Hamburger-menyen er fastspikret 22 px fra toppen (`index.css:428`), men undersider setter inn en «← Til forsiden»-linje som dytter resten av innholdet ned — knappen kolliderer da med tilbake-lenken. Tilbake-linjen følger dessuten med ved scrolling, mens menyknappen scroller vekk. Fiks: legg menyknappen inn i samme topplinje som tilbake-lenken, så følger de alltid hverandre og menyen forblir tilgjengelig under scrolling.

**Hosting og synlighet**
- Legg inn foreslått `web/vercel.json` (ferdig utarbeidet). Effekt: nettleserne får beskjed om at siden aldri skal kunne vises inni andres nettsider eller få filer feiltolket (sikkerhetsheadere — standard hygiene for en side som skal siteres), gjenbesøk laster raskere, og garantien om at leserne alltid ser ferske tall blir eksplisitt i stedet for å hvile på Vercels standardinnstillinger.
- **Delinger ser fattige ut, og lenker husker ikke hva man så på.** Adressene bruker `#` (f.eks. `/#/hvem`): alt etter `#` leses bare av nettleseren, aldri av serveren — det er slik siden navigerer uten egen server. Men delingstjenestenes roboter (Facebook/X/LinkedIn) ser aldri det som står etter `#`, så alle delinger viser samme forhåndsvisning — som i dag er helt tom: uten bilde, med generisk tittel. Lenkene husker heller ikke hva man ser på: valgt periodefane (2011–2013 … 2025–2029), temafilter eller hvilken celle/representant man har klikket ligger bare i sidens minne — så den som deler en lenke etter å ha funnet noe interessant, sender i praksis mottakeren til standardvisningen. Forslag i to trinn: **nå** (timer): ett godt delingsbilde + tittel/beskrivelse for siden, favicon, og legg alle visningsvalg (periodefane, tema, valgt par/representant) i adressen slik at en delt lenke gjenskaper nøyaktig det avsenderen så; **senere**, hvis deling blir viktig kanal: bytt til rene adresser (`/hvem`, `/par/R/FrP`) med eget delingsbilde per side.
- **Eget domene før videre promotering.** `hvastemmerdepa.vercel.app` signaliserer hobbyprosjekt; et eget domene (f.eks. `hvastemmerde.no`) gir troverdighet når siden siteres, og uavhengighet fra Vercel. Gjøres dette tidlig, akkumuleres all omtale og alle sitater på en adresse man selv eier (gamle .vercel.app-lenker videresendes automatisk, men omtale på trykk kan ikke rettes i etterkant). Praktisk: domenekjøp + ~15 min oppsett i Vercel.
- **Vercel-planen.** Siden ligger på gratisplanen, som har to begrensninger verdt å kjenne til: et månedstak på trafikk (brukes det opp, settes siden på pause til neste måned), og et vilkår om at planen kun er for ikke-kommersiell hobbybruk. Med dagens trafikk er man godt innenfor taket. Betalplanen (20 USD/mnd) fjerner begge begrensningene — riktig valg for et publisert journalistisk prosjekt, men det haster ikke.

**Teknisk hygiene**
- Committet `.claude/settings.json` gir alle som åpner repoet i Claude Code brede tillatelser (vilkårlig Python, `gh release`/`gh workflow`) — flytt til `settings.local.json` og ignorer den.
- Ingen LICENSE for koden, og nettstedet lover «koden er åpen» mens repoet er privat: innfri eller omformuler.
- SHA-pin GitHub-actions; legg `.env*`/`.vercel/` i .gitignore; valider datoformatet for persondata (et ISO-skifte hos API-et ville gitt stille 1970-datoer); la nattjobben committe som `github-actions[bot]`.
- Rådata-backupen («raw-seed»-releasen) oppdateres aldri: går Actions-cachen tapt etter en lengre stans, kan gjenopphenting overstige jobbens 45-minutterstak og kreve manuell inngripen. Feiler trygt (bare gamle tall, aldri feil tall) — oppdater releasen av og til og skriv en kort gjenopprettingsprosedyre.

**Jus og etterrettelighet** (ellers rent: NLOD-attribusjon over gjennomsnittet, fotokreditering komplett, null cookies/sporing bekreftet)
- Kort personvernerklæring mangler (enkel: ingen sporing, Stortingets offentlige data, Vercel som leverandør).
- Dokumenter Wikimedia-proveniens per partilogo (særlig Sp og PF); legg til en «feil rettes ved henvendelse»-setning på om-siden.

---

## Ikke verifisert

Vercel-dashboardets innstillinger (kun utledet fra målinger — bare kontoeieren kan inspisere dem) og selve Sikt-nedlastingen i AUDIT.md (ureproduserbar fra repoet, men ikke lenger bærende for noen konklusjon). Ingenting av dette motsies av noe som ble funnet.

## Metode

Syv parallelle spesialiserte gjennomganger pluss en rådata-verifisering: statisk kodelesing, full re-kjøring av pipelinen fra rådata, mutasjonstesting (10 bevisste feil, én om gangen), 12 API-kall mot data.stortinget.no, curl-målinger mot live-siden, dokumentasjonsoppslag (Vercel, GitHub, NLOD, Stortingets vilkår) og søk etter eksterne samtidskilder. Ingenting i repoet er endret.
