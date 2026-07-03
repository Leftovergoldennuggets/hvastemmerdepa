export default function PeriodPicker({ index, periods, selection, onChange }) {
  if (!selection) return null;
  return (
    <nav className="controls" aria-label="Velg tidsrom">
      {[...periods.keys()].map((p) => (
        <button
          key={p}
          className={`tab${selection.kind === "period" && selection.id === p ? " active" : ""}`}
          onClick={() => onChange({ kind: "period", id: p })}
        >
          {p}
        </button>
      ))}
      <select
        value={selection.kind === "sesjon" ? selection.id : ""}
        onChange={(e) => e.target.value && onChange({ kind: "sesjon", id: e.target.value })}
        aria-label="Velg enkeltsesjon"
      >
        <option value="">Enkeltsesjon</option>
        {index.map((s) => (
          <option key={s.sesjon} value={s.sesjon}>
            {s.sesjon}
          </option>
        ))}
      </select>
    </nav>
  );
}
