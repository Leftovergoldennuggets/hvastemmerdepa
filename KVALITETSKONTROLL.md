# Kvalitetskontroll: alt som er gjort for at tallene skal være til å stole på

Dette dokumentet er skrevet for deg som skal vurdere prosjektet uten å kjenne
det fra før. Det forklarer hva nettstedet gjør, hvilke metodevalg som er tatt
og hvorfor, hvilke kontroller som er gjennomført, og — viktigst — hvordan du
selv kan etterprøve alt, med eller uten koding. Sist oppdatert 27. august 2026.

## Hva prosjektet er

[hvastemmerdepa.vercel.app](https://hvastemmerdepa.vercel.app) viser hvor ofte
partiene på Stortinget stemmer likt, basert på alle registrerte voteringer
siden oktober 2011 (da elektronisk votering med enkeltstemmer startet).
Kilden er Stortingets egen åpne datatjeneste. Målgruppen er velgere,
journalister og forskere; prosjektet er ikke-kommersielt og uavhengig.

Dataflyten, i menneskespråk:

1. **Nedlasting** — alle rådata hentes fra data.stortinget.no og lagres
   *uendret* på disk. Ingenting redigeres; alt kan spores tilbake til kilden.
2. **Beregning** — ett Python-program leser rådataene og regner ut
   partistandpunkter og enighetstall. All matematikk skjer her.
3. **Nettside** — en statisk side som *viser* de beregnede tallene. Den
   regner ikke selv (ett unntak: den deler to tall for å vise prosent).

Hele kjeden kjøres automatisk hver morgen, med kontroller (se nedenfor) som
stopper publisering hvis noe ser galt ut.

## Metodevalgene — og hvorfor

| Valg | Begrunnelse |
|---|---|
| Et partis standpunkt = det flertallet av partiets *deltakende* representanter stemte | Partiene stemmer svært samlet (målt: 88–100 % helt uten utbrytere per sesjon), så flertallet er et reelt uttrykk for partilinjen |
| Står partiet helt likt (f.eks. 2–2), har det *ikke noe* standpunkt den voteringen | Å tilskrive et delt parti en mening ville vært å dikte data. Skjer sjelden (254 tilfeller totalt) |
| Uavhengige representanter holdes utenfor partistatistikken | De representerer ikke noe parti |
| Én votering teller én gang — uansett hvor mange forslag den bunter | Etterprøvbart mot referatet (én avstemning = én rad); å telle per forslag krever skjør tekst-tolkning. Avviket mot Holder de ords gamle telling er opplyst på metodesiden |
| «Alternativ votering» telles én gang, ikke to | API-et eksporterer én slik avstemning som to speilvendte rader; speilbildet ekskluderes (1 298 rader). Oppdaget og rettet i revisjonen 22. juli |
| Lovtekniske voteringer («lovens overskrift …») holdes utenfor | Stortingets eget råd for statistikk. De *flagges* i datasettet, slettes ikke |
| Stemmer telles for partiet representanten tilhørte *da stemmen ble avgitt* | Partibyttere (f.eks. Leirstein FrP→Uav) skal ikke omskrive historien. Vara telles for eget parti |
| Enstemmige vedtak inngår aldri i prosentene | De tas uten voteringsanlegget, så enkeltstemmer finnes ikke (6 090 avgjørelser). Konsekvens: tallene måler i praksis «når salen var delt, hvem stemte likt» — bare 99 av 17 927 tellende voteringer hadde alle partier på samme side |
| Splittelser krever minst to utbrytere | Stortinget retter aldri feiltrykk i dataene, så en enkelt avviker kan være en feiltastet stemme |
| Gjennomslag rangeres etter *antall* vedtatte forslag, ikke andel | Opposisjonen fremmer rutinemessig forslag den vet faller; antallet sier mer om reell innflytelse |
| Regjeringsperiodene ligger i en konfigurasjonsfil med kilder | Datoer verifisert mot regjeringen.no; et regjeringsskifte krever ingen kodeendring |

Alle valgene står også offentlig på nettstedets metodeside, og hver endring i
metoden føres i [ENDRINGSLOGG.md](ENDRINGSLOGG.md).

## Kvalitetskontrollene som er gjennomført

| Når | Kontroll | Resultat |
|---|---|---|
| Løpende, hver kjøring | **Egen-verifisering**: for hver votering summeres enkeltstemmene og sammenlignes med Stortingets offisielle for/mot-tall | 19 605 av 19 620 stemmer eksakt; de 3 avvikene (mai 2025, 1–2 stemmer) og 11 voteringer med tomme individdata er opplyst på metodesiden |
| 2. juli 2026 | **Stemmekodene verifisert empirisk** (1 = ikke til stede, 2 = for, 3 = mot) mot offisielle tall | Bekreftet over samtlige 3,3 mill. enkeltstemmer; kun kodene 1/2/3 forekommer |
| 31. aug 2026 | **Uavhengig gjennomgang #2** (ekstern utvikler): full re-kjøring fra rådata, mutasjonstesting, API-stikkprøver, hosting-målinger (RAPPORT-KODEGJENNOMGANG.md) | «Tallene på nettstedet er riktige» — byte-identisk reproduksjon; 7/7 stikkprøver stemte; funnene gjaldt fremtidig drift og er fulgt opp (se ENDRINGSLOGG) |
| 22.–23. juli 2026 | **Full revisjon** av kode og data ([AUDIT.md](AUDIT.md)): alle funn etterprøvd empirisk, rangert etter alvor | Hovedfunn: speilvoteringer ble telt dobbelt (rettet samme dag; effekt ≤ 1 prosentpoeng), gjennomslag manglet én forslagsform (rettet), tre faktafeil på metodesiden (rettet). Alt dokumentert med målt effekt |
| 22. juli 2026 | **Kryssjekk mot Sikt/NSDs uavhengige Voteringsarkiv** (17 815 voteringer koblet på id) | 99,94 % samsvar; alle avvik forklart (Sikt hadde byttet perspektiv på gamle speilpar — våre tall stemte med Stortingets) |
| Juli 2026 | **Sammenligning med Holder de ords metode** (åpen kildekode) | Tre bevisste avvik identifisert, vurdert og dokumentert (telleenhet, delte partier, konsensus-håndtering) |
| 18. aug 2026 | **«Kun omstridte voteringer»-hypotesen målt** før beslutning | Filteret ville flyttet tallene ≤ 0,2 prosentpoeng — konsensus når aldri voteringsanlegget. Bryter droppet; funnet opplyst på siden |
| 19. aug 2026 | **Menneskelig kodegjennomgang #1** (Andreas Moe, NTNU) | Tre innspill, alle fulgt opp samme dag (se neste rad + ENDRINGSLOGG 19. aug) |
| 19. aug 2026 | **JSON↔XML-bevis**: Stortinget dokumenterer bare XML-formatet; skript henter samme data i begge og sammenligner felt for felt | Identisk. Bonus: XML-ens *navngitte* verdier («for»/«mot»/«ikke_tilstede») beviser stemmekodene fra API-et selv — uavhengig av vår empiri |
| Daglig siden 19. aug | **Formatvakt + fornuftssjekk** i den automatiske oppdateringen | Hvert felt pipelinen leser må finnes med riktig type (3,3 mill. stemmer sjekkes per kjøring), og ingen sesjon eller votering får «forsvinne». Feiler noe, publiseres ingenting — siden blir stående på forrige gode versjon |
| Aug 2026 | **Automatiske tester med ekstern fasit** (se egen seksjon) | Kjøres ved hver kodeendring |

## Prosedyrene mot «hallusinering»

Prosjektet er bygget med KI-assistanse, og er derfor designet slik at *ingen
tall noensinne kommer fra en språkmodell*:

1. **Kun ekte rådata.** Alt lastes ned fra Stortingets API og lagres uendret.
   Hvert tall på nettstedet kan regnes ut på nytt fra disse filene av hvem
   som helst — oppskriften står i README.
2. **Frontenden regner ikke.** Nettsiden viser tall fra beregnede filer; det
   finnes ingen «skjulte» beregninger i visningen.
3. **Faktapåstander er beregnet, ikke skrevet.** Alt metodesiden hevder som
   tall (samholds-prosent, avvikslister, antall) genereres av pipelinen fra
   dataene — aldri skrevet inn for hånd. En påstand kan dermed ikke «bli
   igjen» etter at virkeligheten har endret seg.
4. **Endringslogg.** Hver metodeendring føres i ENDRINGSLOGG.md med dato,
   begrunnelse og målt effekt.
5. **Verifiseringsgrense.** Endringer i beregningskoden behandles som «rød
   sone» og krever ny verifisering; kosmetiske endringer gjør ikke. Etter en
   menneskelig gjennomgang tagges koden i git, slik at det senere kan
   *bevises* at beregningene er urørt siden gjennomgangen.
6. **Daglige vakter.** Den automatiske oppdateringen nekter å publisere hvis
   dataformen endrer seg eller tall krymper (voteringsdata er append-only —
   krymping betyr feil).
7. **Automatiske tester med ekstern fasit.** Små, lesbare tester der
   forventet svar kommer fra stortinget.no sine egne sider og fra Sikts
   uavhengige arkiv — aldri fra koden selv (se neste seksjon).

## Det du kan sjekke selv — uten å kode

1. **Stikkprøve en votering.** Velg en hvilken som helst votering på
   nettstedet → følg lenken til stortinget.no → sammenlign for/mot-tallene
   og (for nyere år) partifordelingen. Gjør det for 3–5 voteringer fra
   ulike år.
2. **Kjente politiske fakta.** Sjekk at matrisen viser det alle vet: H×FrP
   svært høyt i 2013–2020 (de satt i regjering sammen), A×Sp høyt 2021–2025,
   R×FrP lavest av alle par.
3. **Last ned og tell.** Hver visning har en «Last ned som CSV»-knapp; radene
   kan telles og sammenlignes mot tallene på siden.
4. **Les testene.** Hver automatiske test har en klartekst-beskrivelse av
   scenarioet og en lenke til fasit-kilden hos stortinget.no.

## Til deg som gjennomgår med Claude (eller annen KI)

Du har tilgang til GitHub-repoet. Alt du trenger ligger der:

- **Koden**: `pipeline/` (~1 100 linjer Python, all beregning) og
  `web/src/lib.js` (eneste fil i nettsiden som regner). Resten av `web/` er
  visning. Les [GJENNOMGANG.md](GJENNOMGANG.md) for en prioritert lesesti.
- **Alle beregnede tall**: `data/computed/` (10 MB JSON). Viktigst er
  `positions/<sesjon>.json` — én rad per votering med hvert partis interne
  for/mot-stemmetall — og `matrix/<sesjon>.json` med parvise enighetstall.
  Feltene er dokumentert på nettstedets «Åpne data»-side.
- **Rådataene**: last ned release-en **raw-seed** (148 MB) fra repoets
  Releases-fane hvis din Claude skal regne alt fra bunnen (~2 min i stedet
  for 7 timers nedlasting).

Ferdige kontrollspørsmål du kan gi din Claude:

1. *«Les metodesiden på hvastemmerdepa.vercel.app/#/metodikk. Regn deretter ut
   Ap×Høyre-enigheten for 2023–2024 direkte fra data/computed/positions/
   2023-2024.json — uten å se på pipeline-koden — og sammenlign med tallet i
   data/computed/matrix/2023-2024.json.»* (Replikasjonstesten: får din Claude
   et annet tall, er enten koden eller metodebeskrivelsen feil.)
2. *«Velg 5 tilfeldige voteringer fra positions-filene, konstruer lenkene
   (https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=SAKID)
   og la meg sammenligne tallene mot stortinget.no.»*
3. *«Verifiser at summen av partienes for/mot i hver rad stemmer med radens
   offisielle for/mot-tall, over alle sesjoner.»*
4. *«Les pipeline/analyse.py og metodesiden parallelt: finn ethvert punkt der
   koden gjør noe metodesiden ikke beskriver, eller omvendt.»*
5. *«Kjør python3 -m unittest discover -s pipeline/tests og forklar meg hva
   hver test beviser.»*

## Kjente svakheter — ærlig listet

- **3 voteringer** (mai 2025) der enkeltstemmene ikke summerer til de
  offisielle tallene (avvik 1–2 stemmer). Ligger i Stortingets kildedata;
  opplyst på metodesiden; spørsmål sendt Stortinget.
- **11 voteringer** har offisielle tall, men tomme enkeltstemme-data i API-et
  — inkludert de politisk følsomme Palestina-voteringene 16. nov 2023. De
  holdes utenfor og er listet på metodesiden; årsaken er et åpent spørsmål
  til Stortinget.
- **Sesjonen 2013–14 har påfallende få registrerte voteringer.** Grundig
  undersøkt: Sikts uavhengige arkiv viser identisk mønster, så det er reell
  parlamentarisk adferd (første året etter regjeringsskiftet 2013), ikke
  datahull.
- **Den grunnleggende begrensningen**: å stemme likt er ikke det samme som å
  være enige. Stortingets egen veiledning sier at materialet ikke kan måle
  «graden av enighet» — den advarselen er sitert ordrett på metodesiden, og
  nettstedet omtaler konsekvent tallene som «stemte likt», aldri «enige».
- Åpne spørsmål til Stortinget er samlet i [AUDIT.md](AUDIT.md), seksjon G.
