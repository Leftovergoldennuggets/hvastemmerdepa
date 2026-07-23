import { useEffect, useState } from "react";
import { partyOrFallback, cellColor } from "./parties.js";
import { aggregateMatrix, pairKey, formatN } from "./lib.js";
import { useTweenedMatrix } from "./Matrix.jsx";
import { downloadCsv } from "./csv.js";
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
    // Keep the previous ranking on screen while the new selection loads,
    // so bars and numbers roll to their new values instead of reloading.
    aggregateMatrix(selectedSessions.map((s) => s.sesjon))
      .then((m) => { if (live) setMatrix(m); })
      .catch(() => { if (live) setMatrix(new Map()); });
    return () => { live = false; };
  }, [selectedSessions]);

  const shown = useTweenedMatrix(matrix);

  let ranking = [];
  if (matrix && shown) {
    const ids = new Set();
    for (const key of matrix.keys()) key.split("|").forEach((id) => ids.add(id));
    ranking = [...ids]
      .filter((id) => id !== party.id)
      .map((id) => {
        const key = pairKey(party.id, id);
        const target = matrix.get(key);
        if (!target || !target.total) return null;
        const cell = shown.get(key) || target;
        return {
          other: partyOrFallback(id),
          agree: cell.agree,
          total: cell.total,
          pct: cell.pct ?? (100 * cell.agree) / cell.total,
          // rows sort by the destination value so the order settles at once
          // while the numbers are still rolling
          sortPct: (100 * target.agree) / target.total,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.sortPct - a.sortPct);
  }

  return (
    <div>
      <div className="pair-head">
        <Logo party={party} />
        <h2>Hvem stemmer {party.navn} med?</h2>
        <p>
          Partiene rangert etter hvor stor andel av voteringene de og{" "}
          {party.kort} stemte likt – regnet av voteringene der begge deltok.
          Trykk på et parti for hele historien: utviklingen over tid og de
          konkrete sakene de var enige og uenige om.
        </p>
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
                <span className="rank-arrow" aria-hidden="true">›</span>
              </a>
            </li>
          ))}
        </ol>
      )}

      <p className="count-note">
        Andel av {formatN(totalVotes)} voteringer {label} der partiene stemte
        likt. Trykk på et parti for detaljene.
        {ranking.length > 0 && (
          <>
            {" · "}
            <button
              className="dl"
              onClick={() =>
                downloadCsv(
                  `${party.kort.toLowerCase()}-enighet-${selection.id}.csv`,
                  ["parti", "enige", "felles_voteringer", "enighet_prosent", "tidsrom"],
                  ranking.map((r) => [
                    r.other.kort, r.agree, r.total,
                    r.pct.toFixed(1).replace(".", ","), selection.id,
                  ])
                )
              }
            >
              Last ned som CSV
            </button>
          </>
        )}
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
