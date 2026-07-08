import { useEffect, useState } from "react";
import { partyOrFallback } from "./parties.js";
import { fetchJSON, formatN } from "./lib.js";
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

export default function PeoplePage() {
  const [data, setData] = useState(null);
  const [periode, setPeriode] = useState(null);

  useEffect(() => {
    fetchJSON("/data/personer.json").then((d) => {
      setData(d);
      setPeriode(Object.keys(d).sort().pop());
    }).catch(() => setData({}));
  }, []);

  if (!data || !periode) return <div className="loading">Laster …</div>;

  const partier = data[periode] || {};
  const rows = Object.entries(partier).filter(([id]) => id !== "Uav");
  const total = Object.values(partier).reduce(
    (acc, v) => ({
      seter: acc.seter + v.seter,
      kvinner: acc.kvinner + v.kvinner,
      alder: acc.alder + (v.snittalder || 0) * v.seter,
      fartstid: acc.fartstid + (v.snitt_fartstid || 0) * v.fartstid_n,
      fn: acc.fn + v.fartstid_n,
    }),
    { seter: 0, kvinner: 0, alder: 0, fartstid: 0, fn: 0 }
  );

  return (
    <div>
      <div className="pair-head">
        <h2>Hvem er de?</h2>
        <p>
          De {total.seter} innvalgte representantene i hver stortingsperiode:
          kjønnsbalanse, alder og erfaring, parti for parti.
        </p>
      </div>

      <nav className="controls" aria-label="Velg stortingsperiode">
        {Object.keys(data).sort().map((p) => (
          <button
            key={p}
            className={`tab${p === periode ? " active" : ""}`}
            onClick={() => setPeriode(p)}
          >
            {p.replace("-", "–")}
          </button>
        ))}
      </nav>

      <div className="matrix-scroll">
        <table className="people-table">
          <thead>
            <tr>
              <th>Parti</th>
              <th>Seter</th>
              <th>Kvinneandel</th>
              <th>Snittalder</th>
              <th>Snitt tid på Stortinget</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([id, v]) => {
              const p = partyOrFallback(id);
              const kv = (100 * v.kvinner) / v.seter;
              return (
                <tr key={id}>
                  <td>
                    <a className="party-key" href={`#/parti/${id}`}>
                      <Logo party={p} /> {p.navn}
                    </a>
                  </td>
                  <td className="num">{v.seter}</td>
                  <td>
                    <span className="kv-cell">
                      <span className="kv-track">
                        <span className="kv-fill" style={{ width: `${kv}%` }} />
                        <span className="kv-mid" />
                      </span>
                      <span className="num">{Math.round(kv)} %</span>
                    </span>
                  </td>
                  <td className="num">{v.snittalder != null ? `${v.snittalder} år`.replace(".", ",") : "–"}</td>
                  <td className="num">
                    {v.snitt_fartstid != null ? `${v.snitt_fartstid} år`.replace(".", ",") : "–"}
                  </td>
                </tr>
              );
            })}
            <tr className="total-row">
              <td>Hele Stortinget</td>
              <td className="num">{total.seter}</td>
              <td className="num">{Math.round((100 * total.kvinner) / total.seter)} %</td>
              <td className="num">{(total.alder / total.seter).toFixed(1).replace(".", ",")} år</td>
              <td className="num">{total.fn ? (total.fartstid / total.fn).toFixed(1).replace(".", ",") : "–"} år</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="count-note">
        Innvalgte representanter ved periodens start (vararepresentanter ikke
        medregnet). Alder ved periodestart; «tid på Stortinget» er tid siden
        representanten først ble innvalgt. Streken i kvinneandel-søylen
        markerer 50 %.{" · "}
        <button
          className="dl"
          onClick={() =>
            downloadCsv(
              `representanter-${periode}.csv`,
              ["parti", "seter", "kvinner", "kvinneandel_prosent", "snittalder", "snitt_aar_paa_stortinget", "periode"],
              rows.map(([id, v]) => [
                partyOrFallback(id).kort, v.seter, v.kvinner,
                ((100 * v.kvinner) / v.seter).toFixed(1).replace(".", ","),
                v.snittalder ?? "", v.snitt_fartstid ?? "", periode,
              ])
            )
          }
        >
          Last ned som CSV
        </button>
      </p>
    </div>
  );
}
