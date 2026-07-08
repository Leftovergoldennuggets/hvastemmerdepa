import { useMemo, useState } from "react";
import { partyOrFallback } from "./parties.js";
import { personPhoto } from "./lib.js";

// Hemicycle seat chart: one dot per elected representative. Seats are laid
// out geometrically and filled left-to-right in the conventional political
// order, so each party forms a wedge. Color modes recolor the same dots by
// gender, age or parliamentary experience.

const LEFT_TO_RIGHT = ["R", "SV", "A", "Sp", "MDG", "KrF", "V", "H", "FrP", "PF"];
const partyOrder = (id) => {
  const i = LEFT_TO_RIGHT.indexOf(id);
  return i === -1 ? LEFT_TO_RIGHT.length : i;
};

const KJONN = { kvinne: "#c4272e", mann: "#2C5F8A" };
const ALDER_BINS = [
  { label: "Under 35 år", test: (a) => a < 35, farge: "#F2C14E" },
  { label: "35–49 år", test: (a) => a < 50, farge: "#6BAED6" },
  { label: "50–64 år", test: (a) => a < 65, farge: "#2171B5" },
  { label: "65 år eller mer", test: () => true, farge: "#0A3D62" },
];
const ERFARING_BINS = [
  { label: "Ny denne perioden", test: (f) => f < 0.1, farge: "#D9782D" },
  { label: "Under 8 år", test: (f) => f < 8, farge: "#6BAED6" },
  { label: "8 år eller mer", test: () => true, farge: "#0A3D62" },
];

const MODES = [
  { id: "parti", label: "Parti" },
  { id: "kjoenn", label: "Kjønn" },
  { id: "alder", label: "Alder" },
  { id: "erfaring", label: "Erfaring" },
];

function bin(bins, value) {
  if (value == null) return null;
  return bins.find((b) => b.test(value));
}

function dotColor(rep, mode) {
  if (mode === "kjoenn") {
    return rep.kjoenn === 1 ? KJONN.kvinne : KJONN.mann;
  }
  if (mode === "alder") return bin(ALDER_BINS, rep.alder)?.farge || "#d8d4ce";
  if (mode === "erfaring") return bin(ERFARING_BINS, rep.fartstid)?.farge || "#d8d4ce";
  return partyOrFallback(rep.parti).farge;
}

// Concentric rows; seats per row proportional to the row's radius so the
// spacing between neighbours stays roughly constant.
function seatLayout(total) {
  const ROWS = 8;
  const r0 = 140;
  const r1 = 340;
  const radii = Array.from({ length: ROWS }, (_, i) => r0 + ((r1 - r0) * i) / (ROWS - 1));
  const weight = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.floor((total * r) / weight));
  let rest = total - counts.reduce((a, b) => a + b, 0);
  for (let i = ROWS - 1; rest > 0; i = (i - 1 + ROWS) % ROWS, rest--) counts[i]++;

  const seats = [];
  radii.forEach((r, row) => {
    const n = counts[row];
    for (let k = 0; k < n; k++) {
      const angle = Math.PI - (Math.PI * k) / (n - 1);
      seats.push({ angle, x: 360 + r * Math.cos(angle), y: 368 - r * Math.sin(angle) });
    }
  });
  // Fill order: left to right across the whole chamber, inner rows first on ties.
  seats.sort((a, b) => b.angle - a.angle || a.y - b.y);
  return seats;
}

function legendFor(reps, mode) {
  if (mode === "parti") {
    const perParti = new Map();
    for (const r of reps) perParti.set(r.parti, (perParti.get(r.parti) || 0) + 1);
    return [...perParti.entries()]
      .sort((a, b) => partyOrder(a[0]) - partyOrder(b[0]))
      .map(([id, n]) => ({ label: partyOrFallback(id).kort, farge: partyOrFallback(id).farge, n }));
  }
  if (mode === "kjoenn") {
    const kv = reps.filter((r) => r.kjoenn === 1).length;
    return [
      { label: "Kvinner", farge: KJONN.kvinne, n: kv },
      { label: "Menn", farge: KJONN.mann, n: reps.length - kv },
    ];
  }
  const bins = mode === "alder" ? ALDER_BINS : ERFARING_BINS;
  const value = mode === "alder" ? (r) => r.alder : (r) => r.fartstid;
  return bins.map((b) => ({
    label: b.label,
    farge: b.farge,
    n: reps.filter((r) => bin(bins, value(r)) === b).length,
  }));
}

export default function Salkart({ representanter, interactive = true }) {
  const [mode, setMode] = useState("parti");
  const [valgt, setValgt] = useState(null);

  const ordered = useMemo(
    () =>
      [...representanter].sort(
        (a, b) =>
          partyOrder(a.parti) - partyOrder(b.parti) ||
          (b.fartstid ?? -1) - (a.fartstid ?? -1) ||
          a.navn.localeCompare(b.navn, "nb")
      ),
    [representanter]
  );
  const seats = useMemo(() => seatLayout(ordered.length), [ordered.length]);
  const legend = legendFor(ordered, mode);
  const valgtParty = valgt && partyOrFallback(valgt.parti);

  return (
    <div className="salkart">
      {interactive && (
        <nav className="controls salkart-modes" aria-label="Fargelegg salen etter">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`tab${m.id === mode ? " active" : ""}`}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </nav>
      )}

      <svg viewBox="0 0 720 380" role="img" aria-label="Stortingssalen: én prikk per representant">
        {ordered.map((rep, i) => {
          const s = seats[i];
          if (!s) return null;
          return (
            <circle
              key={rep.id}
              cx={s.x}
              cy={s.y}
              r={valgt?.id === rep.id ? 11.5 : 9}
              fill={dotColor(rep, mode)}
              stroke={valgt?.id === rep.id ? "#191715" : "#fff"}
              strokeWidth={valgt?.id === rep.id ? 2 : 1}
              style={interactive ? { cursor: "pointer" } : undefined}
              onClick={interactive ? () => setValgt(valgt?.id === rep.id ? null : rep) : undefined}
            >
              {interactive && (
                <title>{`${rep.navn} (${partyOrFallback(rep.parti).kort}), ${rep.fylke || ""}`}</title>
              )}
            </circle>
          );
        })}
      </svg>

      <div className="salkart-legend">
        {legend.map((l) => (
          <span key={l.label}>
            <i style={{ background: l.farge }} /> {l.label} <em>{l.n}</em>
          </span>
        ))}
      </div>

      {!interactive ? null : valgt ? (
        <div className="rep-card">
          <img src={personPhoto(valgt.id)} alt={valgt.navn} loading="lazy" />
          <div>
            <strong>{valgt.navn}</strong>
            <span>
              {valgtParty.navn}
              {valgt.fylke ? ` · ${valgt.fylke}` : ""}
            </span>
            <span>
              {valgt.alder != null && `${Math.floor(valgt.alder)} år`}
              {valgt.fartstid != null &&
                (valgt.fartstid < 0.1
                  ? " · ny på Stortinget denne perioden"
                  : ` · ${Math.round(valgt.fartstid)} år på Stortinget`)}
            </span>
            <span className="foto-kred">Foto: Stortinget</span>
          </div>
          <button className="rep-card-close" aria-label="Lukk" onClick={() => setValgt(null)}>×</button>
        </div>
      ) : (
        <p className="count-note">Trykk på en prikk for å se hvem som sitter der.</p>
      )}
    </div>
  );
}
