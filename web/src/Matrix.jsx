import { useEffect, useRef, useState } from "react";
import { PARTIES, PARTY_BY_ID, partyOrFallback, cellColor, cellText, DIVERGING } from "./parties.js";
import { pairKey, formatN } from "./lib.js";

const THIN_N = 50; // below this many shared votes, the percentage is noisy

/* Tween the matrix values when the selection changes, so numbers roll and
   colors step through the scale (split-flap style, as old HDO did with
   react-motion) instead of the table re-rendering cold. Cells without a
   counterpart in the previous selection snap directly to their value. */
function useTweenedMatrix(matrix) {
  const [disp, setDisp] = useState(matrix);
  const prevRef = useRef(matrix);
  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = matrix;
    if (
      !from || from === matrix ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisp(matrix);
      return;
    }
    const DUR = 650;
    const t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    let raf;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / DUR);
      const k = ease(t);
      const next = new Map();
      for (const [key, to] of matrix) {
        const f = from.get(key);
        if (!f || !f.total || !to.total) {
          next.set(key, to);
          continue;
        }
        const fp = (100 * f.agree) / f.total;
        const tp = (100 * to.agree) / to.total;
        next.set(key, {
          agree: Math.round(f.agree + (to.agree - f.agree) * k),
          total: Math.round(f.total + (to.total - f.total) * k),
          pct: fp + (tp - fp) * k,
        });
      }
      setDisp(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [matrix]);
  return disp ?? matrix;
}

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
  const shown = useTweenedMatrix(matrix);

  // Parties come from the data itself; known ones keep the fixed spectrum
  // order, unknown ids (a future new party) are appended rather than dropped.
  const ids = new Set();
  for (const key of shown.keys()) key.split("|").forEach((id) => ids.add(id));
  // Full symmetric matrix: every party on both axes, values mirrored. The
  // diagonal (a party against itself) is left empty with a subtle hatch,
  // as Holder de ord did — a "100 %" there is noise, not information.
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
                  <a className="party-key col" href={`#/parti/${p.id}`}>
                    <Logo party={p} />
                    {p.kort}
                  </a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((rowP, ri) => (
              <tr key={rowP.id}>
                <th scope="row">
                  <a className="party-key" href={`#/parti/${rowP.id}`}>
                    <Logo party={rowP} />
                    <span className="party-name">{rowP.kort}</span>
                  </a>
                </th>
                {cols.map((colP, ci) => {
                  if (ci === ri) {
                    return <td key={colP.id} className="blank diagonal" aria-hidden="true" />;
                  }
                  const cell = shown.get(pairKey(rowP.id, colP.id));
                  if (!cell || !cell.total) return <td key={colP.id} className="blank" />;
                  const pct = cell.pct ?? (100 * cell.agree) / cell.total;
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
