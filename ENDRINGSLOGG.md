# Endringslogg (audit-trail)

Alle metodiske endringer, feilrettinger og kvalitetskontroller dokumenteres
her, nyeste øverst.

## 2026-07-23 — Frie voteringer, regjeringsmarkører og åpne data-side

- **Splittelser bruker nå Stortingets eget fri votering-flagg** i stedet for
  å anta («ofte samvittighetssaker»): positions- og splits-radene har fått
  feltet `fri` (fra API-feltet `fri_votering`), og merkede voteringer vises
  med etikett. Målt: bare 5 av 676 splittelser skjedde i formelt frie
  voteringer — antakelsen i den gamle teksten var misvisende og er fjernet.
- **Regjeringsskifter tegnes som stiplede linjer** i tidsseriene på
  parsidene (statsministerskifter med navn; koalisjonsendringer uten).
  Plasseringen interpoleres fra dato innenfor sesjonen.
- **Ny side «Åpne data»** (#/data): dokumenterer alle JSON-filene siden
  leser fra, feltbetydninger (inkl. excluded-kodene og `fri`), vilkår og
  kreditering. Lenket fra metodesiden og menyen.
- Kosmetisk (22. juli, eget commit): matrisens diagonal er tom med skravur
  i stedet for «100 %»-celler, som hos Holder de ord.

## 2026-07-22 (senere samme dag) — Metodeside-rettinger og gjennomslag-utvidelse

**Gjennomslag teller nå også alternativ votering (revisjonens punkt B1).**
- Ny parser i `analyse_gjennomslag.py` fanger «forslag … fra <partier>»-
  formuleringen som brukes ved alternativ votering (1 272 voteringer, i
  tillegg til 12 923 «på vegne av»-voteringer). 98 voteringer lar seg ikke
  entydig knytte til partier og holdes utenfor (opplyst på metodesiden).
- Vedtatt-logikk for alternativ votering: forslaget regnes som vedtatt når
  forslagsstillernes side vant en votering med stemmer på begge sider
  (forslagsstillere stemmer alltid for eget forslag). To kanttilfeller ble
  funnet og håndtert under utviklingen, begge verifisert mot stortinget.no:
  votering 3541 (alternativ votering uten alt-lenke i API-et — gjenkjennes
  nå på beskrivelsen) og votering 3381 (0–94-votering der offisielt vedtak
  viser at forslaget falt — derfor kreves stemmer på begge sider).
- Effekt: «fremmet»-tallene øker 5–16 % per parti; gjennomslagsprosentene
  endres marginalt (største utslag FrP 8,2→7,9). Kontrollpåstanden for
  2011–2013 står seg: 2 067 opposisjonsforslag, 0 vedtatt (før: 1 507/0).

**Metodesiden rettet (revisjonens punkt A3, B2, B3):**
- «93–99 prosent»-påstanden om partisamhold erstattet med målt intervall
  som beregnes av pipelinen og leses fra meta.json (i dag 88–100 prosent,
  per parti-sesjon med minst 50 voteringer).
- Feil beskrivelse av når voteringsanlegget brukes («bare når minst én
  representant krever votering») erstattet med korrekt mekanisme i tråd
  med Stortingets egen dokumentasjon.
- Overdreven påstand om at fravær ikke påvirker tallene erstattet med
  målt virkelighet: MDG deltok i 56 % av voteringene 2013–2014,
  Pasientfokus ca. 70 % — nå opplyst på metodesiden.
- De voteringene som mangler individdata i API-et (bl.a. Palestina-
  voteringene 16. nov. 2023) listes nå på metodesiden (fra meta.json,
  feltet data_pending).
- «Enstemmig vedtatt»-regnskapet utvidet til alle avgjørelser uten
  voteringsanlegget (6 090, hvorav 6 009 enstemmige; resten «vedtatt mot
  1 stemme» o.l.).
- Stortingets advarsel sitert ordrett i Begrensninger-avsnittet; den hule
  formuleringen «det gjør vi også» fjernet. Presisert at uavhengige
  representanter ikke inngår i partistatistikken.
- Gjennomslag-avsnittet på metodesiden og «Slik leser du tallene» på
  gjennomslagssiden oppdatert til å beskrive begge forslagsformene;
  2011–2013-påstanden oppdatert fra «over 1 500» til «over 2 000» forslag. Formålet er at enhver – journalist, forsker eller
fagfelle – skal kunne se nøyaktig hva som er endret, når og hvorfor.
Se også AUDIT.md (full kvalitetsrevisjon juli 2026) og metodesiden på
nettstedet.

## 2026-07-22 — Kvalitetsrevisjon og retting av alternativ votering

**Uavhengig revisjon gjennomført** (dokumentert i AUDIT.md): all pipeline-kode
og frontend-kode gjennomgått linje for linje; alle sentrale påstander testet
empirisk mot rådataene.

**Rettet: alternativ votering ble telt dobbelt.**
- Stortingets datatjeneste eksporterer én alternativ votering (salen velger
  mellom to alternativer) som TO speilvendte voteringer, lenket via feltet
  `alternativ_votering_id` (f.eks. 63–38 vedtatt + 38–63 forkastet, samme
  representanter). Pipelinen behandlet dette som to uavhengige voteringer.
- Omfang: 1 297 slike hendelser = 13,5 % av alle radene i enighetsmatrisene.
  Alle 1 297 par verifisert som perfekte speilbilder før retting.
- Retting: `analyse.py` ekskluderer nå tvillingen med høyest votering_id
  (`excluded: "alternativ_speil"`, 1 298 rader). Raden beholdes i
  positions-filene for etterprøvbarhet. `analyse_gjennomslag.py` hopper over
  speilrader. Nettstedet viser nå «talte» voteringer (17 927) i stedet for
  alle registrerte (19 620). Ny forklaring lagt til på metodesiden.
- Effekt på tallene: enighetsprosenter flyttet seg median 0,28 pp, maks
  0,95 pp (FrP×SV 27,1→28,0; R×FrP 27,0→27,8; R×SV 79,0→78,1).
  Splittelser-listen: 748→676 (72 var speil-duplikater).
- Uavhengig støtte: Holder de ords kildekode (hdo-site, Vote#alternate_of?)
  viser at de oppdaget og håndterte samme fenomen.

**Kryssjekk mot Sikts Voteringsarkiv (polsys.sikt.no):**
- 17 815 voteringer koblet én-til-én på Stortingets votering_id.
- For/mot-tall og vedtatt-flagg samsvarer i 17 805 av 17 815 (99,94 %).
- De 10 avvikene er alternativ votering-par fra 2011 der Sikt har byttet om
  de to perspektivene; våre tall stemmer med både Stortingets offisielle
  stemmetall og summen av individstemmene.
- 2013–14-anomalien (svært få voterte avstemninger okt. 2013–apr. 2014)
  bekreftet som reell parlamentarisk atferd: Sikt viser identisk
  månedsmønster og har ingen registrerte voteringer i vinduet som vi mangler.

**Kjente, uløste funn (se AUDIT.md, skal håndteres før lansering):**
- A3: Feil på metodesiden (93–99 %-påstanden; beskrivelsen av når
  voteringsanlegget brukes; fraværspåstanden for småpartier).
- B1: Gjennomslag fanger ikke forslag formulert «fra <parti>» (alternativ
  votering) — ca. 1 026 hendelser.
- B2: 12 voteringer mangler individdata i API-et (bl.a. 7 Palestina-
  voteringer 16. nov. 2023) — må opplyses om.
- B3: ~106 voteringer av typen «vedtatt mot 1 stemme» / «forkastet mot 0
  stemmer» faller utenfor både «registrert» og «enstemmig» i regnskapet.

## Tidligere (før endringsloggen ble opprettet)

Prosjektets historikk fram til 22. juli 2026 er dokumentert i git-loggen.
Metodevalgene som gjaldt ved opprettelsen: partistandpunkt = flertallet av
partiets avgitte stemmer (likt antall = delt/ikke standpunkt); enighet =
samme standpunkt i samme votering; «lovens overskrift»-voteringer ekskludert
etter Stortingets råd; splittelser krever minst to utbrytere (enkeltavvik
kan være feiltrykk som aldri rettes i kildedataene).
