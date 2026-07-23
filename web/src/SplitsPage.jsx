import { useEffect, useState } from "react";
import { PARTIES, partyOrFallback } from "./parties.js";
import { fetchJSON, formatDate, sakUrl } from "./lib.js";
import { downloadCsv } from "./csv.js";

function Logo({ party, size = 24 }) {
  return (
    <span className="logo-tile" style={{ width: size, height: size }}>
      {party.logo ? (
        <img src={party.logo} alt="" loading="lazy" />
      ) : (
        <span style={{ width: "55%", height: "55%", borderRadius: "50%", background: party.farge }} />
      )}
    </span>
  );
}

export default function SplitsPage() {
  const [splits, setSplits] = useState(null);
  const [parti, setParti] = useState("");
  const [sort, setSort] = useState("nyeste");
  const [visible, setVisible] = useState(30);

  useEffect(() => { fetchJSON("/data/splits.json").then(setSplits).catch(() => setSplits([])); }, []);

  if (!splits) return <div className="loading">Laster …</div>;

  const filtered = splits.filter((s) => !parti || s.parti === parti);
  const sorted = [...filtered].sort((x, y) =>
    sort === "største"
      ? Math.min(y.for, y.mot) / (y.for + y.mot) - Math.min(x.for, x.mot) / (x.for + x.mot)
      : String(y.dato || "").localeCompare(String(x.dato || ""))
  );
  const shown = sorted.slice(0, visible);
  const partiesWithSplits = PARTIES.filter((p) => splits.some((s) => s.parti === p.id));

  return (
    <div>
      <div className="pair-head">
        <h2>Splittelser</h2>
        <p>
          Partiene på Stortinget stemmer nesten alltid samlet. Her er de{" "}
          {splits.length} voteringene siden 2011 der minst to representanter
          brøt med sitt eget parti. Der Stortinget selv har registrert
          voteringen som fri – partilinjen formelt opphevet, typisk
          samvittighetssaker – er den merket «fri votering».
        </p>
      </div>

      <div className="filter-tabs">
        <select value={parti} onChange={(e) => { setParti(e.target.value); setVisible(30); }} aria-label="Velg parti">
          <option value="">Alle partier</option>
          {partiesWithSplits.map((p) => (
            <option key={p.id} value={p.id}>{p.navn}</option>
          ))}
        </select>
        <button className={`tab${sort === "nyeste" ? " active" : ""}`} onClick={() => setSort("nyeste")}>
          Nyeste først
        </button>
        <button className={`tab${sort === "største" ? " active" : ""}`} onClick={() => setSort("største")}>
          Største først
        </button>
        <button
          className="dl right"
          onClick={() =>
            downloadCsv(
              `splittelser${parti ? "-" + parti.toLowerCase() : ""}.csv`,
              ["dato", "parti", "for", "mot", "fri_votering", "sak_id", "sak", "votering_tema", "lenke"],
              sorted.map((s) => [
                s.dato || "", partyOrFallback(s.parti).kort, s.for, s.mot,
                s.fri ? "ja" : "nei",
                s.sak, s.tittel || "", s.tema || "", sakUrl(s.sak),
              ])
            )
          }
        >
          Last ned som CSV
        </button>
      </div>

      <ol className="votelist-plain">
        {shown.map((s) => {
          const p = partyOrFallback(s.parti);
          return (
            <li key={`${s.vid}-${s.parti}`} className="vote-row">
              <div className="vote-meta">
                {s.dato ? formatDate(s.dato) : ""}
                <span className="split-party">
                  <Logo party={p} size={20} /> {p.kort}
                </span>
              </div>
              <div className="vote-main">
                <a href={sakUrl(s.sak)} target="_blank" rel="noreferrer">{s.tittel}</a>
                <div className="vote-tema">
                  {s.tema}
                  {s.fri && <> {" "}<span className="fri-tag">fri votering</span></>}
                </div>
              </div>
              <div className="vote-stances">
                <span><strong>{s.for}</strong> for</span>
                <span><strong>{s.mot}</strong> mot</span>
              </div>
            </li>
          );
        })}
      </ol>
      {sorted.length > visible && (
        <button className="more" onClick={() => setVisible((v) => v + 30)}>
          Vis flere ({sorted.length - visible} igjen)
        </button>
      )}
      <p className="empty-note">
        Enkeltrepresentanter som stemmer «feil» rettes aldri i Stortingets data;
        derfor vises bare voteringer der minst to representanter avvek.
        Tallene er representanter for og mot innad i partiet.
      </p>
    </div>
  );
}
