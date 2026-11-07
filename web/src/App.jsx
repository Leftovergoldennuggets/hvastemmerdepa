import { useEffect, useRef, useState } from "react";
import Matrix from "./Matrix.jsx";
import PairView from "./PairView.jsx";
import PartyView from "./PartyView.jsx";
import MethodPage from "./MethodPage.jsx";
import SplitsPage from "./SplitsPage.jsx";
import PeoplePage from "./PeoplePage.jsx";
import GjennomslagPage, { GjennomslagRanking, GjTemaVelger } from "./GjennomslagPage.jsx";
import { useGjennomslag } from "./useGjennomslag.js";
import MaalingVelger from "./ForMot.jsx";
import { utvalgEtikett } from "./maaling.js";
import ForstaPage from "./ForstaPage.jsx";
import OmPage from "./OmPage.jsx";
import DataPage from "./DataPage.jsx";
import PeriodPicker from "./PeriodPicker.jsx";
import { PARTIES, partyOrFallback } from "./parties.js";
import { downloadCsv } from "./csv.js";
import Salkart from "./Salkart.jsx";
import { medHistorikk } from "./komiteer.js";
import { sessionsIndex, siteMeta, aggregateMatrix, aggregateKomite, komiteerData, formatN, formatDate, personerData, fetchJSON, aggregateForMot, forMotMatrix, antallIUtvalg } from "./lib.js";
import { useTimeSelection } from "./useTimeSelection.js";
import { parsePath, pathFromLegacyHash, seo, SITE } from "./routes.js";

// Real paths (/par/R/FrP, /parti/R) so every view is a permalink that search
// engines index on its own. Old #/-links are rewritten in place on load.
function initialRoute() {
  const legacy = pathFromLegacyHash(window.location.hash);
  if (legacy) window.history.replaceState(null, "", legacy);
  return parsePath(window.location.pathname);
}

function navigate(path) {
  if (path !== window.location.pathname) window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

// Internal links are plain <a href="/…">; clicks on them are handled here
// instead of reloading the page. Data files, images and anything opened in a
// new tab or with a modifier key are left to the browser.
function interceptLink(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest && e.target.closest("a[href]");
  if (!a || a.target || a.hasAttribute("download")) return;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin) return;
  if (/^\/(data|fotos|logos)\//.test(url.pathname) || /\.\w+$/.test(url.pathname)) return;
  e.preventDefault();
  navigate(url.pathname);
}

function setHead(selector, attr, value) {
  const el = document.head.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

function Menu({ inline = false }) {
  const [open, setOpen] = useState(false);
  return (
    <nav className={`menu${inline ? " menu-inline" : ""}`}>
      <button
        className="menu-btn"
        aria-expanded={open}
        aria-label="Meny"
        onClick={() => setOpen(!open)}
      >
        <span /><span /><span />
      </button>
      {open && (
        <div className="menu-panel" onClick={() => setOpen(false)}>
          <a href="/">Hjem</a>
          <a href="/splittelser">Splittelser</a>
          <a href="/gjennomslag">Gjennomslag</a>
          <a href="/hvem">Hvem er de?</a>
          <a href="/forsta">Hvordan forstå tallene</a>
          <a href="/metodikk">Metode</a>
          <a href="/apne-data">Åpne data</a>
          <a href="/om">Om prosjektet</a>
        </div>
      )}
    </nav>
  );
}

// Home-page teaser: the current chamber as a seat chart, linking to
// the full "Hvem er de?" page. Data comes from the published pipeline
// output at load time — nothing hardcoded.
function HomeSalkart() {
  const [reps, setReps] = useState(null);
  const [periode, setPeriode] = useState(null);

  useEffect(() => {
    personerData().then((d) => {
      const latest = Object.keys(d).sort().pop();
      setPeriode(latest);
      setReps(d[latest].representanter);
    }).catch(() => {});
  }, []);

  if (!reps) return null;
  return (
    <section className="party-chips">
      <h2>Hvem sitter i salen?</h2>
      <p>
        Stortinget består av folkevalgte. Her er alle {reps.length}{" "}
        representantene{periode && ` valgt for ${periode.replace("-", "–")}`} –
        én prikk per person, farget etter parti. Trykk deg inn for å se salen
        fordelt på kjønn, alder og erfaring, og hvor i landet representantene
        kommer fra.
      </p>
      <a className="home-salkart" href="/hvem" aria-label="Se hvem representantene er">
        <Salkart representanter={reps} interactive={false} />
      </a>
      <p className="see-also">
        <a href="/hvem">Se hvem de er – kjønn, alder og erfaring ›</a>
      </p>
    </section>
  );
}

function HomeSplits() {
  const [splits, setSplits] = useState(null);
  useEffect(() => { fetchJSON("/data/splits.json").then(setSplits).catch(() => {}); }, []);
  if (!splits || splits.length === 0) return null;
  return (
    <section className="party-chips home-splits">
      <h2>Når sprekker partiene?</h2>
      <p>
        Hovedregelen på Stortinget er at partiene stemmer samlet. Men av og
        til – for eksempel i samvittighetsspørsmål – sprekker et parti. Her er
        de ferskeste voteringene der minst to representanter stemte mot
        flertallet i sitt eget parti:
      </p>
      <ol className="home-splits-list">
        {splits.slice(0, 3).map((s) => {
          const p = partyOrFallback(s.parti);
          return (
            <li key={`${s.vid}-${s.parti}`}>
              <a href="/splittelser">
                <span className="hs-dato">{s.dato ? formatDate(s.dato) : ""}</span>
                <span className="hs-parti">
                  <span className="logo-tile" style={{ width: 22, height: 22 }}>
                    {p.logo ? (
                      <img src={p.logo} alt="" loading="lazy" />
                    ) : (
                      <span style={{ width: "55%", height: "55%", borderRadius: "50%", background: p.farge }} />
                    )}
                  </span>
                  {p.kort}
                </span>
                <span className="hs-tittel">{s.tittel}</span>
                <span className="hs-tall">{s.for}–{s.mot}</span>
              </a>
            </li>
          );
        })}
      </ol>
      <p className="see-also">
        <a href="/splittelser">Alle splittelser siden 2011 ›</a>
      </p>
    </section>
  );
}

function HomeOm() {
  return (
    <section className="party-chips home-om">
      <h2>Om prosjektet</h2>
      <figure className="om-figur">
        <img
          src="/anders.jpg"
          alt="Anders Eidesvik i rød skjorte står med armene i kors foran Stortingsbygningen i Oslo, ved siden av en av steinløvene ved inngangen, under blå himmel"
          width="1600"
          height="1066"
          loading="lazy"
          onError={(e) => { e.currentTarget.parentElement.style.display = "none"; }}
        />
        <figcaption>Foto: Simon Eidesvik</figcaption>
      </figure>
      <div className="om-tekst">
        <div>
          <p>
            Hva stemmer de? er et uavhengig, ikke-kommersielt
            samfunnsprosjekt laget av Anders Eidesvik. Han er tidligere
            journalist i NRK, Klassekampen og Dagens Næringsliv. Målet er å
            gjøre Stortingets voteringer lett tilgjengelige for folk flest,
            slik at alle kan se hva våre folkevalgte holder på med. Prosjektet
            har åpen kildekode og åpen metode, og dataene kan brukes fritt til
            journalistikk eller annet, mot kreditering.
          </p>
          <p className="see-also" style={{ textAlign: "left" }}>
            <a href="/om">Mer om prosjektet og hvem som står bak ›</a>
          </p>
        </div>
      </div>
    </section>
  );
}

function HomeGjennomslag({ sessions, label, komiteNavn }) {
  const [tema, setTema] = useState("");
  const { ranking, komiteValg } = useGjennomslag(sessions, tema);
  if (!ranking) return null;
  const temaTekst = tema ? ` i saker fra ${komiteNavn[tema] || tema}` : "";

  return (
    <section className="party-chips home-gj">
      <h2>Hvem får gjennomslag?</h2>
      <p>
        Partier som ikke får viljen sin i komiteen, fremmer egne forslag i
        salen. Her kan du se hvor mange av disse voteringene som endte med
        vedtak for hvert parti {label}{temaTekst}. Rangeringen går etter
        antallet, ikke andelen, siden partier i opposisjon fremmer mange
        forslag de vet vil falle. Regjeringspartienes politikk ligger stort
        sett i komiteens innstilling og telles ikke her.
      </p>
      <GjTemaVelger komiteValg={komiteValg} komiteNavn={komiteNavn} tema={tema} onChange={setTema} />
      {ranking.length ? (
        <GjennomslagRanking ranking={ranking} lenke={() => "/gjennomslag"} />
      ) : (
        <p className="empty-note" style={{ textAlign: "center" }}>
          Ingen partiforslag til votering {label}{temaTekst}.
        </p>
      )}
      <p className="see-also">
        <a href="/gjennomslag">Hele bildet – og forslagene som ble vedtatt ›</a>
      </p>
    </section>
  );
}

function Credit({ meta, full }) {
  return (
    <footer className="credit">
      <span>
        Kilde: <a href="https://data.stortinget.no">Stortingets tjeneste for åpne data</a> (NLOD).
        {full && " Datagrunnlaget kan lastes ned og etterprøves."}
      </span>
      {meta && <span>Sist oppdatert {formatDate(meta.generated)}</span>}
    </footer>
  );
}

export default function App() {
  const [index, setIndex] = useState(null);
  const [route, setRoute] = useState(initialRoute);
  const [meta, setMeta] = useState(null);
  const { periods, selection, setSelection, selectedSessions, label, totalVotes } =
    useTimeSelection(index);
  const [matrix, setMatrix] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [tema, setTema] = useState("");
  const [komiteAgg, setKomiteAgg] = useState(null);
  const [komiteNavn, setKomiteNavn] = useState({});
  // «Stemte likt / for det samme / mot det samme» × «alle / innstilling /
  // forslag». The default reading uses the verified matrix files directly;
  // the others come from the for/mot breakdown (same sums, checked nightly).
  const [maaling, setMaaling] = useState("likt");
  const [utvalg, setUtvalg] = useState("alle");
  const [forMot, setForMot] = useState(null);
  const sisteVist = useRef(null);

  const [indexError, setIndexError] = useState(false);
  const loadIndex = () => {
    setIndexError(false);
    sessionsIndex().then(setIndex).catch(() => setIndexError(true));
  };
  useEffect(loadIndex, []);
  useEffect(() => { siteMeta().then(setMeta).catch(() => {}); }, []);
  useEffect(() => { komiteerData().then((d) => setKomiteNavn(medHistorikk(d))).catch(() => {}); }, []);

  useEffect(() => {
    const onPop = () => { setRoute(parsePath(window.location.pathname)); window.scrollTo(0, 0); };
    window.addEventListener("popstate", onPop);
    document.addEventListener("click", interceptLink);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("click", interceptLink);
    };
  }, []);

  // Keep the tab title and share tags in step with the view. The prerendered
  // HTML already has the right values on first load; this covers in-app
  // navigation.
  useEffect(() => {
    const s = seo(route);
    document.title = s.title;
    setHead('meta[name="description"]', "content", s.description);
    setHead('link[rel="canonical"]', "href", SITE + s.path);
    setHead('meta[property="og:url"]', "content", SITE + s.path);
    setHead('meta[property="og:title"]', "content", s.title);
    setHead('meta[property="og:description"]', "content", s.description);
  }, [route]);

  useEffect(() => {
    if (!selectedSessions.length) return;
    let live = true;
    // Keep the previous matrix on screen while the new one loads — the
    // switch then animates cell by cell (HDO-style) instead of flashing
    // a loading state. Data is small and cached, so the gap is tiny.
    setLoadError(false);
    const ids = selectedSessions.map((s) => s.sesjon);
    Promise.all([aggregateMatrix(ids), aggregateKomite(ids)])
      .then(([m, k]) => {
        if (!live) return;
        setMatrix(m);
        setKomiteAgg(k);
        setTema((t) => (t && !k.byKomite.has(t) ? "" : t));
      })
      .catch(() => { if (live) setLoadError(true); });
    return () => { live = false; };
  }, [selectedSessions]);

  const standard = maaling === "likt" && utvalg === "alle";
  const forMotKey = `${selectedSessions.map((s) => s.sesjon).join(",")}|${tema}`;
  useEffect(() => {
    if (standard || !selectedSessions.length) return;
    let live = true;
    const ids = selectedSessions.map((s) => s.sesjon);
    aggregateForMot(ids, tema)
      .then((d) => { if (live) setForMot({ key: forMotKey, ...d }); })
      .catch(() => { if (live) setLoadError(true); });
    return () => { live = false; };
  }, [forMotKey, standard]); // eslint-disable-line

  const forMotKlar = forMot && forMot.key === forMotKey;
  let shownMatrix;
  let antallVist = null;
  if (standard) {
    shownMatrix = tema && komiteAgg ? komiteAgg.byKomite.get(tema) : matrix;
    antallVist = tema && komiteAgg ? komiteAgg.counts.get(tema) : totalVotes;
  } else if (forMotKlar) {
    shownMatrix = forMotMatrix(forMot.pairs, maaling, utvalg);
    // for/mot leave alternative votes out (both sides vote FOR something)
    antallVist = maaling === "likt"
      ? antallIUtvalg(forMot.antall, utvalg)
      : utvalg === "alle"
        ? forMot.antall.innstilling + forMot.antall.forslag + forMot.antall.annet
        : forMot.antall[utvalg];
  } else {
    // Still loading: keep the last matrix on screen so the switch animates.
    shownMatrix = sisteVist.current;
  }
  if (shownMatrix && (standard || forMotKlar)) sisteVist.current = shownMatrix;
  const temaTekst = tema ? ` (${komiteNavn[tema] || tema})` : "";
  const matrixLabel = `${label}${temaTekst}${utvalgEtikett(utvalg)}`;

  return (
    <div className="shell">
      {route.view !== "matrix" ? (
        <div className="topbar">
          <a href="/">← Til forsiden</a>
          <Menu inline />
        </div>
      ) : (
        <Menu />
      )}
      <header className="masthead">
        <h1><a href="/">Hva stemmer de?</a></h1>
      </header>

      {!index || !selection ? (
        indexError ? (
          <div className="loading">
            Kunne ikke laste dataene. Sjekk nettforbindelsen –{" "}
            <button className="tab" onClick={loadIndex}>prøv igjen</button>
          </div>
        ) : (
          <div className="loading">Laster data …</div>
        )
      ) : ["method", "forsta", "om", "data"].includes(route.view) ? (
        <main>
          {route.view === "method" ? <MethodPage />
            : route.view === "forsta" ? <ForstaPage />
            : route.view === "data" ? <DataPage />
            : <OmPage />}
          <Credit meta={meta} />
        </main>
      ) : route.view === "splits" ? (
        <main>
          <SplitsPage />
          <Credit meta={meta} />
        </main>
      ) : route.view === "people" ? (
        <main>
          <PeoplePage />
          <Credit meta={meta} />
        </main>
      ) : route.view === "gjennomslag" ? (
        <main>
          <GjennomslagPage index={index} />
          <Credit meta={meta} />
        </main>
      ) : route.view === "party" ? (
        <main>
          <PartyView index={index} party={route.party} />
          <Credit meta={meta} />
        </main>
      ) : route.view === "pair" ? (
        <main>
          <PairView index={index} a={route.a} b={route.b} />
          <Credit meta={meta} />
        </main>
      ) : (
        <main>
          <p className="matrix-intro">
            Lurer du på hvor ofte Arbeiderpartiet og Høyre er på samme side?
            Eller Rødt og FrP? Matrisen under viser andelen voteringer der to
            partier stemte likt – grønt betyr ofte, rødt sjelden. Men å stemme
            likt kan bety to ting: at begge stemte for, eller at begge stemte
            mot. Nesten tre av fire voteringer gjelder forslag som partier
            fremmer i salen, oftest fra mindretallet, og dem stemmer de største
            partiene ofte ned sammen. Med bryterne under kan du derfor også se
            hvor ofte partiene stemte <em>for</em> det samme. Tallene er
            hentet fra Stortingets egne voteringsdata og oppdateres daglig.
            De inkluderer bare voteringer der Stortinget delte seg, siden
            enstemmige vedtak ikke registreres i voteringsanlegget.{" "}
            <a href="/forsta">Slik leser du tallene ›</a>
          </p>

          <PeriodPicker index={index} periods={periods} selection={selection} onChange={setSelection} />

          {komiteAgg && (
            <div className="tema-row">
              <label htmlFor="tema">Tema</label>
              <select id="tema" value={tema} onChange={(e) => setTema(e.target.value)}>
                <option value="">Alle temaer</option>
                {[...komiteAgg.counts.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([kid, n]) => (
                    <option key={kid} value={kid}>
                      {komiteNavn[kid] || kid} · {formatN(n)} voteringer
                    </option>
                  ))}
              </select>
            </div>
          )}

          <MaalingVelger
            maaling={maaling}
            utvalg={utvalg}
            onMaaling={setMaaling}
            onUtvalg={setUtvalg}
          />

          <p className="tap-hint">
            Trykk på en rute for å sammenligne to partier – prøv f.eks.{" "}
            <a href="/par/R/FrP">Rødt × FrP</a> eller{" "}
            <a href="/par/A/H">Ap × Høyre</a>.
          </p>

          {shownMatrix ? (
            <Matrix
              matrix={shownMatrix}
              label={matrixLabel}
              maaling={maaling}
              onSelect={(a, b) => navigate(`/par/${a.id}/${b.id}`)}
            />
          ) : loadError ? (
            <div className="loading">
              Kunne ikke laste dataene.{" "}
              <button className="tab" onClick={() => setSelection({ ...selection })}>
                Prøv igjen
              </button>
            </div>
          ) : (
            <div className="loading">Beregner …</div>
          )}

          <p className="count-note">
            {maaling === "likt"
              ? "Hver rute: andelen av voteringene der begge partiene tok standpunkt, der de stemte likt."
              : `Hver rute: av voteringene der minst ett av de to partiene stemte ${maaling}, andelen der begge stemte ${maaling}.`}{" "}
            Grunnlaget er opptil <strong>{antallVist == null ? "…" : formatN(antallVist)}</strong>{" "}
            voteringer {matrixLabel}
            {maaling !== "likt" && " – hold pekeren over en rute for tallene for hvert par"}.
            {shownMatrix && (
              <>
                {" · "}
                <button
                  className="dl"
                  onClick={() => {
                    const maalingNavn = { likt: "stemte_likt", for: "stemte_for_det_samme", mot: "stemte_mot_det_samme" }[maaling];
                    const rows = [...shownMatrix.entries()].map(([key, c]) => {
                      const [pa, pb] = key.split("|");
                      return [
                        partyOrFallback(pa).kort, partyOrFallback(pb).kort,
                        c.agree, c.total, ((100 * c.agree) / c.total).toFixed(1).replace(".", ","),
                        maalingNavn, utvalg, selection.id, tema ? (komiteNavn[tema] || tema) : "alle",
                      ];
                    });
                    downloadCsv(
                      `${maalingNavn.replaceAll("_", "-")}-${selection.id}${utvalg !== "alle" ? "-" + utvalg : ""}${tema ? "-" + tema : ""}.csv`,
                      ["parti_a", "parti_b", "antall", "av_voteringer", "andel_prosent", "maaling", "voteringer", "tidsrom", "tema"],
                      rows
                    );
                  }}
                >
                  Last ned som CSV
                </button>
              </>
            )}
          </p>

          <HomeSalkart />

          <HomeGjennomslag sessions={selectedSessions} label={label} komiteNavn={komiteNavn} />

          <HomeSplits />

          <HomeOm />

          <section className="party-chips">
            <h2>Utforsk ett parti</h2>
            <p>
              Nysgjerrig på hvordan partiet ditt stemmer? Trykk på partiene
              nedenfor for å se hvordan de stemmer i konkrete saker, og ikke
              minst hvem de oftest og sjeldnest stemmer likt med.
            </p>
            <div className="chips-row">
              {PARTIES.filter((p) =>
                matrix && [...matrix.keys()].some((k) => k.split("|").includes(p.id))
              ).map((p) => (
                <a key={p.id} className="party-chip" href={`/parti/${p.id}`}>
                  <span className="logo-tile" style={{ width: 24, height: 24 }}>
                    <img src={p.logo} alt="" loading="lazy" />
                  </span>
                  {p.navn}
                </a>
              ))}
            </div>
          </section>

          <Credit meta={meta} full />
        </main>
      )}
    </div>
  );
}
