import { useEffect, useState } from "react";
import { PARTIES, partyOrFallback, cellColor, cellText } from "./parties.js";
import { aggregateMatrix, pairKey, formatN } from "./lib.js";
import { useTimeSelection } from "./useTimeSelection.js";
import PeriodPicker from "./PeriodPicker.jsx";

function Logo({ party, size = 40 }) {
  return (
    <span className="logo-tile" style={{ width: size, height: size }}>
      {party.logo ? (
        <img src={party.logo} alt="" />
      ) : (
        <span style={{ width: "55%", height: "55%", borderRadius: "50%", background: party.farge }} />
      )}
    </span>
  );
}

export default function PartyView({ index, party }) {
  const { periods, selection, setSelection, selectedSessions, label, totalVotes } =
    useTimeSelection(index);
  const [matrix, setMatrix] = useState(null);
  const [tip, setTip] = useState(null);

  useEffect(() => {
    if (!selectedSessions.length) return;
    let live = true;
    setMatrix(null);
    aggregateMatrix(selectedSessions.map((s) => s.sesjon))
      .then((m) => { if (live) setMatrix(m); })
      .catch(() => { if (live) setMatrix(new Map()); });
    return () => { live = false; };
  }, [selectedSessions]);

  let ranking = [];
  if (matrix) {
    const ids = new Set();
    for (const key of matrix.keys()) key.split("|").forEach((id) => ids.add(id));
    ranking = [...ids]
      .filter((id) => id !== party.id)
      .map((id) => ({ other: partyOrFallback(id), ...matrix.get(pairKey(party.id, id)) }))
      .filter((r) => r.total > 0)
      .map((r) => ({ ...r, pct: (100 * r.agree) / r.total }))
      .sort((a, b) => b.pct - a.pct);
  }

  return (
    <div>
      <a className="back-link" href="#/">← Alle partier</a>
      <div className="pair-head">
        <Logo party={party} />
        <h2>Hvem stemmer {party.navn} med?</h2>
      </div>

      <PeriodPicker index={index} periods={periods} selection={selection} onChange={setSelection} />

      {!matrix ? (
        <div className="loading">Beregner …</div>
      ) : ranking.length === 0 ? (
        <p className="empty-note">
          {party.navn} hadde ingen registrerte voteringer {label}.
        </p>
      ) : (
        <ol className="ranking">
          {ranking.map((r) => (
            <li key={r.other.id}>
              <a
                className="rank-row"
                href={`#/par/${party.id}/${r.other.id}`}
                onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, ...r })}
                onMouseLeave={() => setTip(null)}
              >
                <span className="rank-label">
                  <Logo party={r.other} size={26} />
                  {r.other.kort}
                </span>
                <span className="rank-track">
                  <span
                    className="rank-bar"
                    style={{ width: `${r.pct}%`, background: cellColor(r.pct) }}
                  />
                </span>
                <span className="rank-pct">{Math.round(r.pct)} %</span>
              </a>
            </li>
          ))}
        </ol>
      )}

      <p className="count-note">
        Andel av {formatN(totalVotes)} voteringer {label} der partiene stemte
        likt. Trykk på et parti for detaljene.
      </p>

      {tip && (
        <div
          className="tooltip"
          style={{ left: Math.min(tip.x + 14, window.innerWidth - 300), top: tip.y + 16 }}
        >
          <div className="pct">{tip.pct.toFixed(1).replace(".", ",")} %</div>
          <div>
            {party.navn} og {tip.other.navn} stemte likt i {formatN(tip.agree)} av{" "}
            {formatN(tip.total)} voteringer {label}.
          </div>
        </div>
      )}
    </div>
  );
}
