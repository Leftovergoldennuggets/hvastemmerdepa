# Kvalitetskontroll / Quality audit — 22 July 2026

Independent code-and-data audit performed before public launch. Every finding
below was verified against the actual raw data in `data/raw/` (not just by
reading code). Findings are ranked by severity. A finding is only listed as
CONFIRMED when it was reproduced empirically.

**Overall verdict:** The pipeline is honest and well-built — no hidden bias,
no fabricated data, and its self-verification (summing individual votes
against Stortinget's official tallies) passes for 19,605 of 19,620 votes.
But there are two substantive methodology errors (alternative votes counted
twice; gjennomslag missing ~1,000 proposals), several factual errors on the
methodology page, and one unexplained data anomaly (2013–14) that must be
resolved or disclosed before launch.

---

## A. CRITICAL — fix before launch

### A1. Alternative votes are counted twice everywhere ("alternativ votering")

> **STATUS: FIXED 22 July 2026.** analyse.py now excludes the mirror twin
> (`excluded: "alternativ_speil"`, 1,298 rows), analyse_gjennomslag.py skips
> them, the UI counts use the new `counted` field, and the method page
> explains it. Verified: 1,297 events counted exactly once, zero duplicates.
> Effect: agreement percentages moved by median 0.28 pp, max 0.95 pp
> (FrP×SV 27.1→28.0, R×FrP 27.0→27.8, R×SV 79.0→78.1); splits list
> 748→676 (72 were mirror duplicates); displayed totals now 17,927.

**What happens in the chamber:** when a minority proposal is a direct
alternative to the committee recommendation, Stortinget holds ONE vote where
each representative chooses between the two options ("alternativ votering").

**What the API does:** it records that single event as TWO voteringer with
mirrored results (e.g. votering 24896: 63–38, vedtatt; votering 24897: 38–63,
not vedtatt — same representatives, flipped). The rows are linked by the
`alternativ_votering_id` field, which the pipeline currently ignores.

**Confirmed impact (measured):**
- 1,297 voting events appear as 2,594 rows = **13.5 % of all 19,224
  non-excluded votes are duplicates**. All 1,297 pairs verified perfectly
  mirrored.
- Every agreement percentage double-weights these events. They are typically
  clear bloc-against-bloc showdowns, so pairs that disagree on them are
  pushed further apart than a one-event-one-vote count would show.
- All displayed totals ("X felles voteringer", "19 620 registrerte
  voteringer") are inflated by ~7 %.
- **User-visible bug:** on pair pages, each alternative vote appears TWICE in
  the vote lists — same date, same case, same description — once as "R for,
  MDG mot" and once as "R mot, MDG for". A journalist will notice this and it
  looks like a data error. The CSV downloads contain the same duplicates.

**Fix:** in `analyse.py`, when `alternativ_votering_id` is set, keep one row
per pair (e.g. the lower `votering_id`) and mark the twin
`excluded: "alternativ_speil"` so it stays in positions/ for transparency.
Document on the method page. Note: which row you keep does not change
agree/disagree outcomes (verified: pairs are exact mirrors), only the weight.

### A2. The 2013–2014 session is a massive outlier — explain or disclose

> **STATUS: LARGELY RESOLVED 22 July 2026** via cross-check against Sikt's
> Voteringsarkiv (independent research archive, downloaded by Anders).
> Sikt shows the IDENTICAL monthly pattern (Oct 3, Nov 6, Dec 41, Feb 5,
> Mar 7, Apr 6 recorded votes) and has ZERO recorded votes in that window
> that we lack. Sikt also shows the decisions from those months as
> non-recorded (unanimous) rows — the meetings happened, but almost nothing
> was contested. Conclusion: the dip is real parliamentary behaviour (first
> year of the Solberg government under the four-party cooperation deal),
> not a hole in our fetch. Caveat: Sikt's modern data ultimately derives
> from Stortinget's records too, so still worth one referat-PDF spot check
> and the question to the Stortinget contact — but confidence is now high.

2013–14 has 284 recorded votes; every other session has 705–2,429. From
October 2013 to April 2014 there are only ~68 recorded votes (January 2014:
zero recorded; ~15 voteringer total including unanimous ones). The recorded
share is 43 % vs ~70 % in neighbouring sessions.

Possible explanations: (a) genuinely calmer first year under the new Solberg
government + the four-party cooperation deal, since minority proposals have
grown enormously over the decade; (b) a gap in Stortinget's own data.
The electronic system demonstrably worked (recorded votes exist in every
month except Jan 2014), which weakens (b) but does not settle it.

**Action:** this is the #1 question for your Stortinget contact. Independent
check: pick 2–3 voting days in Feb–Mar 2014, open the referat PDF on
stortinget.no, count the voteringer in the minutes and compare against
`data/raw/voteringer/` for those saker (protocol in section F).
Until explained, the method page should flag 2013–14 explicitly.

### A3. Factual errors on the methodology page (MethodPage.jsx)

> **STATUS: FIXED 22 July 2026.** Unity claim now computed by the pipeline
> and rendered from meta.json (measured 88–100 %); voting-system mechanism
> rewritten per Stortinget's own docs; absence claim replaced with measured
> participation rates (MDG 56 % in 2013–14, PF ~70 %); "det gjør vi også"
> removed and Stortinget's no-measurement-unit warning quoted verbatim.
> See ENDRINGSLOGG.md.

The site's central promise is "ingen skjulte valg", so the method page must
be exactly right. Three claims are currently false or overstated:

1. **"i 93–99 prosent av voteringene stemmer alle representantene i et parti
   likt"** — FALSE. Measured range is 87–100 %: H 87.2 %, FrP 88.5 %,
   A 89.8 % in 2011–12. Recent sessions are 92–99 %. Fix the numbers or drop
   the claim.
2. **"Stortinget bruker bare anlegget når minst én representant krever
   votering"** — WRONG MECHANISM. Stortinget's own description: the
   electronic system is used in most votes ("benyttes i de fleste
   voteringene"); unanimous decisions are taken without individual recording,
   and anyone opposed would have to stand up, "skjer sjelden". There is no
   "krever votering" rule. Rewrite.
3. **"utbyttingsordningen … så fravær påvirker ikke partistandpunktene"** —
   OVERSTATED. True for large parties; false for one-seat parties. Measured:
   MDG participated in only **56 %** of votes in 2013–14 (91 % in 2016–17),
   Pasientfokus ~68–72 %. Their agreement numbers are computed only over the
   votes they attended — which skews toward the issues they prioritise.
   Stortinget's own docs add that representatives on committee travel are not
   substituted. Disclose this; consider a footnote on MDG/PF columns in thin
   periods.
4. (Lesser, same page) **"Stortingets arkiv anbefaler å supplere med
   kvalitative vurderinger – det gjør vi også."** The site does not actually
   do qualitative assessments. Cut "det gjør vi også" or say what it means
   concretely (e.g. the interpretation guidance on Forstå-siden).

---

## B. IMPORTANT — fix or consciously accept before launch

### B1. Gjennomslag misses ~1,026 proposal events (7–8 %), non-randomly

> **STATUS: FIXED 22 July 2026.** Parser now also counts "forslag … fra
> <partier>" (1,272 votes). For head-to-head votes the proposal counts as
> adopted when the proposers' side won a contested vote (both sides > 0);
> two edge cases (votering 3541, 3381) were caught and verified against
> stortinget.no during development. The 2011–13 claim survives:
> 2,067 opposition proposals, 0 adopted. 98 unparseable votes disclosed.

`analyse_gjennomslag.py` only counts votes whose description says "på vegne
av X". But proposals decided by **alternativ votering** are phrased
"…forslagene 1–3 **fra** Sp, SV, R og MDG" — 1,026 such events (deduplicated
for the mirror problem in A1) are invisible to the gjennomslag statistics.

This is not random noise: alternative votes are used precisely when a
minority proposal stands a real chance of becoming the decision. So the
current numbers systematically undercount both "fremmet" and, potentially,
"vedtatt" for opposition parties.

Also confirmed: a handful of "på vegne av"-votes are skipped even though a
party is named ("FrP og uavhengig representant Ulf Leirstein", "representanten
Jette F. Christensen og SV" — ~5 votes), and 8 descriptions end in a bare
"på vegne av ." and are lost.

**Options:** (a) parse the "fra <partier>" pattern too, and for alternative
votes decide "vedtatt" by whether the proposers' side won (their own
representatives' votes tell you which side that was); or (b) keep the current
definition but state on the method page that proposals settled by alternativ
votering (~1,000 of ~14,000) are not counted. (a) is more truthful; (b) is
acceptable if disclosed.

The claim on the Gjennomslag page — "ikke ett eneste av opposisjonens over
1 500 forslag ble vedtatt" (2011–13) — verifies against current data
(1,507 fremmet, 0 vedtatt) but must be rechecked after any fix here.

### B2. Twelve recorded votes silently lack individual voting data

> **STATUS: DISCLOSED 22 July 2026.** publish.py now exports the list
> (meta.json `data_pending`, 11 votes after alternativ-dedup — one of the
> seven Palestine votes was a mirror twin) and the method page lists them
> all. Remaining action: ask Stortinget why the data is empty (section G).

The API returns an empty individual-votes list for 12 votes even though
official tallies exist. They include politically sensitive ones:
**7 votes on recognition of Palestine (16 Nov 2023)**, the Korona commission
statement (May 2021), and 4 budget votes (Dec 2024). The pipeline correctly
excludes them from matrices (`excluded: "data_pending"`), but nothing on the
site says so, and session summaries report `pending_backfill: 0` because the
files exist but are empty (two different code paths — `analyse.py` only
counts a vote as pending when the file is *missing*).

**Action:** disclose these 12 on the method page like the 3 verify-mismatches
are disclosed; ask Stortinget (web@stortinget.no) why voteringsresultat is
empty for them. A journalist searching for the Palestine votes and not
finding them is a credibility risk.

### B3. ~106 votes fall through the cracks between "recorded" and "enstemmig"

> **STATUS: FIXED 22 July 2026.** analyse.py now reports `uten_anlegg`
> (all decisions without the electronic count, 6,090) and the method page
> presents that figure with "enstemmig vedtatt" (6,009) as its subset.

Votes with result type "Vedtatt mot 1 stemme" (39), "Forkastet mot 0 stemmer"
(67) etc. carry `antall_for/mot = -1`, so they are neither "recorded" nor
counted in the "enstemmig vedtatt" figure the method page cites (that figure
only counts type 5). Unanimous *rejections* are also mislabeled by the
sentence "vedtak enstemmig vedtatt". Small numbers, but the method page
currently implies every vote is either recorded or enstemmig vedtatt.
Reword to "avgjort uten voteringsanlegget" and fold in these types.

### B4. The "symbolic votes" question — framing, not bug

What the site measures is *voting coincidence over contested votes*, and the
contested votes are dominated by minority proposals ("mindretallsforslag" and
"løse forslag") that everyone knows will fall. These are largely
signal/position votes — parties use them to put their politics on record.
There is no flag in the data marking a vote "symbolic"; Stortinget's own
guidance says flatly: "Det finnes … ingen måleenhet i dette materialet som
kan brukes til å måle graden av enighet eller uenighet."

Consequences to be honest about:
- Agreement percentages between opposition parties are heavily shaped by
  whether they co-sign each other's doomed proposals — a real signal of
  political proximity, but not the same as "agreeing on policy outcomes".
- The *level* (61 % vs 55 %) is not interpretable in isolation; the
  *comparison* between pairs and over time is the defensible product.
- Subsidiær stemmegivning (voting for a second-best option after your own
  proposal falls) makes some "agreements" tactical. Already mentioned on the
  method page — good.

The method page's "Begrensninger" section covers much of this, but the
strongest sentence from Stortinget (no measurement unit for agreement) is
paraphrased weakly. Recommendation: quote it, and state explicitly that the
site measures "hvor ofte partiene stemte likt", never "hvor enige partiene
er" — and audit every headline/standfirst for that distinction.
(The masthead "Hvor ofte stemmer partiene likt" is fine.)

### B5. Free votes (samvittighetsvotering) are in the data but unused

266 votes carry `fri_votering: true` (party discipline released); 68 are in
the matrices. Counting them as "party positions" is defensible but worth a
sentence on the method page. Better: the Splits page currently *guesses*
("ofte samvittighetssaker") — it could instead *label* splits that occurred
in flagged free votes. Nice-to-have, not blocking.

---

## C. MINOR

- **Salkart is schematic**, but in the real chamber representatives sit by
  county, not by party. "Hvem sitter i salen?" + party wedges could be read
  as actual seating. One caption word fixes it ("skjematisk").
- **President's double votes** (types 8/9, ~9 votes): tallies like 43–43 are
  resolved by the president's double vote; fine in the data, invisible in the
  method text. No action needed beyond B3's rewording.
- **TimeSeries x-axis years are hardcoded** (`["2011","2013","2017","2021",
  "2025"]` in PairView.jsx) — after the 2029 election the chart gets no new
  label until someone edits it. Same class of issue: `GOVERNMENTS` in
  analyse.py must be hand-extended at every government change (this is
  documented, at least).
- **"Uav" (independents) are excluded** from all party statistics — correct,
  but not stated on the method page.
- **Gjennomslag counts voteringer, not forslag**: "Forslag nr. 2 og 3 på
  vegne av SV og R" is one vote over two proposals, counted once. The method
  page says "teller alle slike partiforslag" — s/partiforslag/voteringer over
  partiforslag/.
- **meta.recorded_votes includes** the 12 pending and 384 lovteknisk-excluded
  votes; matrix denominators exclude them. "Datagrunnlaget omfatter …" is
  fair phrasing, but keep in mind when quoting totals.

## D. VERIFIED CORRECT (worth telling the hired reviewer so they can re-verify)

- Vote codes: only 1/2/3 occur in all 2,313,738 individual votes
  (1=absent 1,341,647; 2=for 749,820; 3=against 1,222,271). The README's
  claim is right.
- Official-tally verification: 19,605/19,620 votes reproduce Stortinget's
  antall_for/antall_mot exactly; the 3 mismatches (May 2025, off by 1–2) are
  disclosed on the method page; 12 are the empty ones in B2.
- No vote is double-assigned across sessions (0 duplicate votering_ids after
  the session-date filter — the mirror issue in A1 is a different mechanism).
- Quorum sanity: no vote has fewer than 85 members voting (Grunnloven § 73);
  651 votes have 160+ (grunnlovssaker etc.) — plausible.
- Party attribution follows the representative's party AT VOTE TIME (checked
  Leirstein FrP→Uav and Bøhler A across the switch dates), so party switches
  do not contaminate history. Vara votes carry the vara's own party.
- Government-period dates in analyse.py match the historical record
  (Solberg 16 Oct 2013, V in 17 Jan 2018, KrF in 22 Jan 2019, FrP out
  24 Jan 2020, Støre 14 Oct 2021, Sp out 4 Feb 2025).
- "Lovens overskrift" exclusion (384 votes) matches Stortinget's own advice
  and is flagged, not deleted, in positions/ — good transparency.
- Gjennomslag's "~70 av 13 000" exclusion claim: measured exactly 70 of
  12,995.
- The single-dissenter threshold for the Splits page (≥2 dissenters, because
  mis-presses are never corrected) matches Stortinget's documented caveat.
- Raw data is stored byte-for-byte and every computed number is
  re-derivable; the site never computes numbers beyond summing pipeline
  output (verified in lib.js — the one exception is percentage division).

## E. External cross-checks available

- **Sikt (NSD) Voteringsarkivet** — polsys.sikt.no/storting/voteringsarkiv —
  vote-level records 1814 onwards, JSON download.
  **CROSS-CHECK PERFORMED 22 July 2026:** joined 17,815 votes on
  Stortinget's votering_id. For/mot tallies and vedtatt-flags agree on
  17,805 of 17,815 (99.94 %); the only 10 "disagreements" are alternativ
  votering pairs from 2011 where Sikt swapped the two perspectives — our
  numbers match Stortinget's official tallies AND the summed individual
  votes, so ours are right. Only 3 Sikt-recorded votes are absent from our
  data (all three lack counts in Sikt too); the 1,805 votes Sikt lacks are
  the 2025–26 session (after their export cutoff) plus 9 old votes.
  Also confirmed the 2013–14 pattern (see A2).
- **Holder de ord** — site defunct, but code and data pipelines are open at
  github.com/holderdeord (their `hdo-transcript-search` / data repos).
  Their issue tracker may also document the 2013–14 question.
- **OverStortinget** (overstortinget.no) — independent live site on Storting
  activity; useful for sanity-comparing per-session counts.
- **Academic**: party cohesion/agreement literature on the Nordic
  parliaments (e.g. Rasch on Storting voting) publishes Rice-index and
  agreement figures to compare orders of magnitude.

## F. Spot-check protocol (run this yourself; repeat after every data update)

Each check takes ~10 minutes and requires no coding beyond running a command.

1. **One vote, end to end.** Pick any vote on the site → follow its link to
   stortinget.no → open the case's voteringsoversikt → compare for/mot
   totals and the party breakdown (stortinget.no shows per-party votes for
   recent years). Verify the site's stance for both parties matches.
   Do this for 3 votes: one recent, one ~2015, one alternativ votering.
2. **One matrix cell, recomputed.** Download the pair CSV for e.g. Ap×Høyre
   in one session; check that rows ÷ agreements reproduce the percentage in
   the matrix; sample 5 rows against stortinget.no.
3. **One day's minutes.** Open a referat PDF for a voting day (start with
   25 Feb 2014 and 4 Mar 2014 for the A2 question), count voteringer in the
   minutes, compare with the API data for those cases.
4. **Aggregates against Sikt.** Request one session's data from
   Voteringsarkivet; compare total vote count and one pair's agreement count.
5. **A politically known fact.** Sanity checks a journalist would do:
   H×FrP should be near-100 % during 2013–2020; A×Sp high during 2021–2025;
   R×FrP should be the lowest pair. Confirm the matrix shows these.
6. **The replication test (your idea #14).** Give another AI (or the hired
   reviewer) ONLY the method page text and API docs, have them compute one
   session's Ap×H percentage from scratch. If they can't, the method page is
   incomplete; if they get a different number, one of you is wrong. After
   fixing A1, this test should converge.

## G. Questions for your Stortinget contact

1. Why does 2013–14 (especially Oct 2013–Apr 2014) have so few recorded
   voteringer — real consensus politics, or incomplete data?
2. Why do 12 voteringer (incl. the seven Palestine votes of 16 Nov 2023)
   return an empty voteringsresultat despite official tallies existing?
3. Confirm: is one "alternativ votering" always exported as two mirrored
   voteringer? Is keeping one per pair the correct de-duplication?
4. The 3 votes in May 2025 where individual sums differ from official
   tallies by 1–2 — which side is authoritative?
5. Is there any official marker (beyond fri_votering) for
   presedens/formality votes we should exclude, à la "lovens overskrift"?
