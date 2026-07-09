// Selector compacto de tipo IVA por linea. Tipos comunes en Espanya:
//   21% (general), 10% (reducido), 4% (superreducido), 0% (exento).
// Si quieren un valor distinto pueden elegir "Otro…" y meter el numero.
//
// Props:
//   value     → number o null/undefined si "usar global"
//   onChange  → callback con number o null
//   defaultPct → tipo global del documento (para mostrarlo en la opcion "Global")
//   disabled
//
// Visual: un <select> compacto que muestra "21% global" cuando value === null.

const PRESETS = [21, 10, 4, 0];

function IvaPicker({ value, onChange, defaultPct, disabled }) {
  const isCustom = value != null && !PRESETS.includes(Number(value));
  const selectValue = value == null ? '__global__' : (isCustom ? '__custom__' : String(value));

  function handleChange(e) {
    const v = e.target.value;
    if (v === '__global__') {
      onChange(null);
    } else if (v === '__custom__') {
      // Pedimos un valor por prompt — minimo es lo mas simple sin meter
      // un input adicional. Para v1.3.0 con esto vamos.
      const raw = window.prompt('Introduce el % de IVA para esta línea:', '21');
      if (raw == null) return;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        window.alert('Valor no válido. Introduce un número entre 0 y 100.');
        return;
      }
      onChange(n);
    } else {
      onChange(Number(v));
    }
  }

  return (
    <select
      value={selectValue}
      onChange={handleChange}
      disabled={disabled}
      title="Tipo de IVA aplicado a esta línea"
      className="px-2 py-1.5 border border-slate-300 rounded-md text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand disabled:bg-slate-100 disabled:cursor-not-allowed"
    >
      <option value="__global__">
        IVA {Number(defaultPct) || 0}% (global)
      </option>
      {PRESETS.map((p) => (
        <option key={p} value={p}>
          IVA {p}%
        </option>
      ))}
      {isCustom && (
        <option value={String(value)}>
          IVA {value}%
        </option>
      )}
      <option value="__custom__">Otro…</option>
    </select>
  );
}

export default IvaPicker;
