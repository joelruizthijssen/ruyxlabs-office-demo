// v1.5.0: gestion de socios internos por empresa. Un socio = colaborador
// interno con el que se reparte un % de la base imponible de facturas y
// gastos (para llevar una cuenta interna no fiscal). Multi-empresa: cada
// empresa tiene su propia lista. UI oculta si la lista esta vacia.
//
// Al crear/editar/borrar se emite 'socios-changed' para que la sidebar,
// FacturaEditor, GastoEditorModal y la pagina Cuenta socios se refresquen.

import { useEffect, useState } from 'react';
import { Plus, Trash2, User } from 'lucide-react';
import { useToast } from './Toast.jsx';

const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand text-sm';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

function emitChanged() {
  window.dispatchEvent(new CustomEvent('socios-changed'));
}

function SocioRow({ socio, onChanged }) {
  const toast = useToast();
  const [nombre, setNombre] = useState(socio.nombre || '');
  const [saldoInicial, setSaldoInicial] = useState(String(socio.saldo_inicial ?? 0));
  const [notas, setNotas] = useState(socio.notas || '');
  const [busy, setBusy] = useState(false);

  async function guardar() {
    if (!nombre.trim()) { toast.error('El nombre no puede estar vacio'); return; }
    setBusy(true);
    try {
      const res = await window.api.socios.update(socio.id, {
        nombre: nombre.trim(),
        saldo_inicial: Number(saldoInicial) || 0,
        notas: notas.trim() || null,
      });
      if (res?.error) { toast.error(res.error); return; }
      toast.success('Socio guardado');
      emitChanged();
      onChanged?.();
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function eliminar() {
    if (!confirm(
      `Eliminar el socio "${socio.nombre}"?\n\n` +
      'Los porcentajes en facturas y gastos antiguos se conservan intactos ' +
      '(el socio queda archivado, no se borra fisicamente). Podras acceder ' +
      'a documentos anteriores igual.',
    )) return;
    try {
      await window.api.socios.delete(socio.id);
      toast.success('Socio eliminado');
      emitChanged();
      onChanged?.();
    } catch (e) {
      toast.error(e.message ?? String(e));
    }
  }

  return (
    <div className="p-4 border border-slate-200 rounded-lg bg-white">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
          <User size={18} className="text-brand" />
        </div>
        <div className="flex-1 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Nombre del socio</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className={inputCls}
                placeholder="ej. Diana"
              />
            </div>
            <div>
              <label className={labelCls}>Saldo inicial (opcional)</label>
              <input
                type="number"
                step="0.01"
                value={saldoInicial}
                onChange={(e) => setSaldoInicial(e.target.value)}
                className={inputCls}
                placeholder="0.00"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Deuda arrastrada de antes de usar la app (Excel viejo, etc.).
              </p>
            </div>
            <div>
              <label className={labelCls}>Notas (opcional)</label>
              <input
                type="text"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className={inputCls}
                placeholder="ej. socio comercial 50%"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={guardar}
              disabled={busy}
              className="px-3 py-1.5 bg-brand text-white rounded-lg text-sm hover:bg-brand-dark disabled:opacity-50"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={eliminar}
              className="px-3 py-1.5 border border-red-300 text-red-700 rounded-lg text-sm hover:bg-red-50 inline-flex items-center gap-1"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SociosManager() {
  const toast = useToast();
  const [socios, setSocios] = useState([]);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [busy, setBusy] = useState(false);

  async function recargar() {
    try {
      const rows = await window.api.socios.list();
      setSocios(Array.isArray(rows) ? rows : []);
    } catch {
      setSocios([]);
    }
  }

  useEffect(() => {
    recargar();
    const onEmpresaChanged = () => recargar();
    window.addEventListener('empresa-changed', onEmpresaChanged);
    return () => window.removeEventListener('empresa-changed', onEmpresaChanged);
  }, []);

  async function crear() {
    if (!nuevoNombre.trim()) { toast.error('Escribe un nombre'); return; }
    setBusy(true);
    try {
      const res = await window.api.socios.create({ nombre: nuevoNombre.trim() });
      if (res?.error) { toast.error(res.error); return; }
      toast.success(`Socio "${nuevoNombre}" creado`);
      setNuevoNombre('');
      emitChanged();
      await recargar();
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-600">
          Los socios internos son colaboradores con los que compartes un % de
          la base imponible de facturas y gastos (cuenta interna no fiscal).
          Si tienes alguno, anadelo aqui y podras marcar el % correspondiente
          en cada linea. Si no, deja la lista vacia y esta funcion no
          aparecera en la app.
        </p>
      </div>

      {socios.length === 0 ? (
        <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center text-sm text-slate-500">
          Todavia no hay socios en esta empresa.
        </div>
      ) : (
        <div className="space-y-3">
          {socios.map((s) => (
            <SocioRow key={s.id} socio={s} onChanged={recargar} />
          ))}
        </div>
      )}

      <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
        <label className={labelCls}>Anadir un nuevo socio</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') crear(); }}
            className={inputCls}
            placeholder="Nombre del socio (ej. Diana, Marta, Juan...)"
          />
          <button
            type="button"
            onClick={crear}
            disabled={busy || !nuevoNombre.trim()}
            className="px-4 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand-dark disabled:opacity-50 inline-flex items-center gap-1 shrink-0"
          >
            <Plus size={16} /> Anadir
          </button>
        </div>
      </div>
    </div>
  );
}

export default SociosManager;
