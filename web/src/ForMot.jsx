// Bryterne for måling og utvalg, med en alltid synlig forklaring.
// Tekstene ligger i maaling.js.
import { MAALINGER, UTVALG } from "./maaling.js";

export default function MaalingVelger({ maaling, utvalg, onMaaling, onUtvalg }) {
  const m = MAALINGER.find((x) => x.id === maaling);
  const u = UTVALG.find((x) => x.id === utvalg);
  return (
    <div className="maaling">
      <div className="maaling-row" role="group" aria-label="Hva skal måles?">
        <span className="maaling-label">Vis</span>
        {MAALINGER.map((x) => (
          <button
            key={x.id}
            className={`tab${x.id === maaling ? " active" : ""}`}
            aria-pressed={x.id === maaling}
            title={x.hjelp}
            onClick={() => onMaaling(x.id)}
          >
            {x.navn}
          </button>
        ))}
      </div>
      <div className="maaling-row" role="group" aria-label="Hvilke voteringer?">
        <span className="maaling-label">Voteringer</span>
        {UTVALG.map((x) => (
          <button
            key={x.id}
            className={`tab${x.id === utvalg ? " active" : ""}`}
            aria-pressed={x.id === utvalg}
            title={x.hjelp}
            onClick={() => onUtvalg(x.id)}
          >
            {x.navn}
          </button>
        ))}
      </div>
      {/* Alltid synlig forklaring av valget – hover finnes ikke på mobil. */}
      <p className="maaling-hjelp" aria-live="polite">
        <strong>{m.navn}:</strong> {m.hjelp}
        {utvalg !== "alle" && <> <strong>{u.navn}:</strong> {u.hjelp}</>}
        {maaling !== "likt" && utvalg === "alle" && (
          <> Alternative voteringer, der salen velger mellom to forslag, er bare
          med i «stemte likt» – der stemmer begge sider for noe.</>
        )}
      </p>
    </div>
  );
}
