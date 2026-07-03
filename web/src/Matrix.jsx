import { useState } from "react";
import { PARTIES, PARTY_BY_ID, partyOrFallback, cellColor, cellText, DIVERGING } from "./parties.js";
import { pairKey, formatN } from "./lib.js";

const THIN_N = 50; // below this many shared votes, the percentage is noisy

function Logo({ party, size = 26 }) {
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

function Tooltip({ tip }) {
  if (!tip) return null;
  if (tip.self) {
    return (
      <div className="tooltip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 300), top: tip.y + 16 }}>
        <div>{tip.self.navn} stemmer per definisjon likt med seg selv.</div>
      </div>
    );
  }
  const { x, y, a, b, agree, total, label } = tip;
  const pct = (100 * agree) / total;
  return (
    <div className="tooltip" style={{ left: Math.min(x + 14, window.innerWidth - 300), top: y + 16 }}>
      <div className="pct">{pct.toFixed(1).replace(".", ",")} %</div>
      <div>
        {a.navn} og {b.navn} stemte likt i {formatN(agree)} av {formatN(total)}{" "}
        voteringer {label}.
      </div>
      {total < THIN_N && (
        <div className="muted">Få felles voteringer – tolk med varsomhet.</div>
      )}
    </div>
  );
}

export default function Matrix({ matrix, label, onSelect }) {
  const [tip, setTip] = useState(null);

  // Parties come from the data itself; known ones keep the fixed spectrum
  // order, unknown ids (a future new party) are appended rather than dropped.
  const ids = new Set();
  for (const key of matrix.keys()) key.split("|").forEach((id) => ids.add(id));
  // Full symmetric matrix: every party on both axes, values mirrored, and a
  // 100 % diagonal (a party always agrees with itself) as a reading anchor.
  const present = [
    ...PARTIES.filter((p) => ids.has(p.id)),
    ...[...ids].filter((id) => !PARTY_BY_ID[id]).sort().map(partyOrFallback),
  ];
  const rows = present;
  const cols = present;

  return (
    <>
      <div className="matrix-scroll">
        <table className="matrix" aria-label={`Andel voteringer der partiene stemte likt, ${label}`}>
          <thead>
            <tr>
              <th aria-hidden="true"></th>
              {cols.map((p) => (
                <th key={p.id} scope="col">
                  <span className="party-key col">
                    <Logo party={p} />
                    {p.kort}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((rowP, ri) => (
              <tr key={rowP.id}>
                <th scope="row">
                  <span className="party-key">
                    <Logo party={rowP} />
                    <span className="party-name">{rowP.kort}</span>
                  </span>
                </th>
                {cols.map((colP, ci) => {
                  if (ci === ri) {
                    return (
                      <td
                        key={colP.id}
                        className="cell diagonal"
                        style={{ background: cellColor(100), color: cellText(100) }}
                        onMouseMove={(e) =>
                          setTip({ x: e.clientX, y: e.clientY, self: rowP })
                        }
                        onMouseLeave={() => setTip(null)}
                      >
                        100
                      </td>
                    );
                  }
                  const cell = matrix.get(pairKey(rowP.id, colP.id));
                  if (!cell || !cell.total) return <td key={colP.id} className="blank" />;
                  const pct = (100 * cell.agree) / cell.total;
                  return (
                    <td
                      key={colP.id}
                      className={`cell${cell.total < THIN_N ? " thin" : ""}`}
                      style={{ background: cellColor(pct), color: cellText(pct) }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${rowP.navn} og ${colP.navn}: ${Math.round(pct)} prosent`}
                      onClick={() => onSelect?.(rowP, colP)}
                      onKeyDown={(e) => e.key === "Enter" && onSelect?.(rowP, colP)}
                      onMouseMove={(e) =>
                        setTip({ x: e.clientX, y: e.clientY, a: rowP, b: colP, ...cell, label })
                      }
                      onMouseLeave={() => setTip(null)}
                    >
                      {Math.round(pct)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ramp-legend">
        <span>Oftest uenige</span>
        <span className="bar">
          {DIVERGING.map((c) => (
            <span key={c} style={{ background: c }} />
          ))}
        </span>
        <span>Oftest enige</span>
      </div>
      <Tooltip tip={tip} />
    </>
  );
}
