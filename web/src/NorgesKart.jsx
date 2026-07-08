import { useState } from "react";
import KART from "./norgeskart.json";
import { partyOrFallback, politicalOrder } from "./parties.js";

// Geographic map of the 19 valgdistrikter (official Kartverket geometry,
// simplified in the pipeline — see pipeline/build_kart.py). Each district
// gets a marker sized by its number of seats; clicking shows who they are.

// Display-only marker nudges where districts crowd around the Oslofjord.
const NUDGE = { Oslo: [-24, -14], Akershus: [24, 6] };
const R = 16; // uniform marker radius (viewBox units); the number is the data

export default function NorgesKart({ representanter }) {
  const [valgt, setValgt] = useState(null);

  const byFylke = {};
  for (const r of representanter) {
    if (r.fylke) (byFylke[r.fylke] = byFylke[r.fylke] || []).push(r);
  }
  const { _viewBox, _kilde, ...distrikter } = KART;
  const velg = (navn) => setValgt((v) => (v === navn ? null : navn));
  const reps = (valgt ? byFylke[valgt] || [] : []).slice().sort(
    (a, b) =>
      politicalOrder(a.parti) - politicalOrder(b.parti) ||
      a.navn.localeCompare(b.navn, "nb")
  );

  return (
    <div className="kart-layout">
      <svg viewBox={_viewBox} className="norgeskart" role="img" aria-label="Valgdistriktene">
        {Object.entries(distrikter).map(([navn, g]) => (
          <path
            key={navn}
            d={g.d}
            className={`kart-flate${valgt === navn ? " valgt" : ""}`}
            onClick={() => velg(navn)}
          >
            <title>{navn}</title>
          </path>
        ))}
        {Object.entries(distrikter).map(([navn, g]) => {
          const n = (byFylke[navn] || []).length;
          if (!n) return null;
          const [dx, dy] = NUDGE[navn] || [0, 0];
          return (
            <g
              key={navn}
              className={`kart-merke${valgt === navn ? " valgt" : ""}`}
              onClick={() => velg(navn)}
            >
              <circle cx={g.cx + dx} cy={g.cy + dy} r={R} />
              <text x={g.cx + dx} y={g.cy + dy}>{n}</text>
              <title>{`${navn}: ${n} representanter`}</title>
            </g>
          );
        })}
      </svg>

      <div className="kart-panel">
        {valgt ? (
          <>
            <h3>{valgt}</h3>
            <p className="kart-panel-sub">{reps.length} representanter</p>
            <ul>
              {reps.map((r) => {
                const p = partyOrFallback(r.parti);
                return (
                  <li key={r.id}>
                    <i style={{ background: p.farge }} />
                    {r.navn} <span>({p.kort})</span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="empty-note">
            Tallet i sirkelen er antall seter. Trykk på et valgdistrikt for å
            se hvem som er valgt derfra.
          </p>
        )}
      </div>
    </div>
  );
}
