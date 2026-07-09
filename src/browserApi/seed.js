// Semilla realista para el demo web. Se corre UNA VEZ tras crear la BD fresca
// (sin restore de IndexedDB), en initDb(). Idempotente: si ya hay datos, no
// duplica. Objetivo: la app arranca "con vida" para que el visitante vea
// dashboards con datos y no se le presente una app vacia.

import { getDb } from './db.js';

function _r(sql, params) {
  const db = getDb();
  const s = db.prepare(sql);
  try { s.run(params); } finally { s.finalize(); }
}
function _lastId() {
  const db = getDb();
  const s = db.prepare('SELECT last_insert_rowid() AS id');
  try { return s.get().id; } finally { s.finalize(); }
}
function _get(sql, params) {
  const db = getDb();
  const s = db.prepare(sql);
  try { return s.get(params); } finally { s.finalize(); }
}

// Genera fecha relativa hacia atras desde hoy en formato YYYY-MM-DD.
function _fecha(diasAtras) {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return d.toISOString().slice(0, 10);
}

export function runSeed() {
  const db = getDb();
  // Guard: si ya hay 5+ facturas, asumimos que la BD tiene datos.
  const facturasCount = _get('SELECT COUNT(*) AS c FROM facturas');
  if (facturasCount && facturasCount.c >= 5) return { seeded: false };

  db.exec('BEGIN');
  try {
    // --- Segunda empresa (la primera se crea en db.js) ---
    _r(`
      INSERT INTO empresas (
        tipo, nombre, nif, direccion, emisor_cp, emisor_ciudad,
        emisor_provincia, emisor_pais, telefono, email, iban,
        tipo_negocio, ciudad_emision, brand_color, iva_default
      ) VALUES (
        'autonomo', 'Estudio Fotografia Demo', '12345678A', 'Rambla 45',
        '17001', 'Girona', 'Girona', 'España',
        '972 000 111', 'info@estudio-demo.local', 'ES2100491500051234567892',
        'servicios', 'Girona', '#8b5cf6', 21
      )
    `);

    // --- Clientes de la empresa nº 1 ---
    const clientes = [
      { nombre: 'Tienda Local BCN SL', nif: 'B87654321', tipo: 'empresa',
        email: 'admin@tiendalocal.local', direccion: 'Carrer Gran 5',
        ciudad: 'Barcelona', cp: '08002', provincia: 'Barcelona' },
      { nombre: 'Carlos Martinez Ruiz', nif: '11111111H', tipo: 'autonomo',
        email: 'carlos@demo.local', direccion: 'Av. Diagonal 200',
        ciudad: 'Barcelona', cp: '08008', provincia: 'Barcelona' },
      { nombre: 'Innovaciones Tech SL', nif: 'B12345678', tipo: 'empresa',
        email: 'contacto@innovtech.local',
        direccion: 'C/ Balmes 100', ciudad: 'Barcelona', cp: '08008' },
      { nombre: 'Maria Lopez Sanchez', nif: '22222222J', tipo: 'particular',
        email: 'maria.lopez@correo.local', direccion: 'C/ Marina 50',
        ciudad: 'Barcelona', cp: '08005' },
      { nombre: 'Gestoria Pep Guardiola', nif: 'B99999999', tipo: 'empresa',
        email: 'admin@gestoria-pg.local', direccion: 'Av. Meridiana 250',
        ciudad: 'Barcelona', cp: '08016' },
      { nombre: 'Studio Design Firenze', nif: 'IT01234567890', tipo: 'empresa',
        email: 'ciao@studiofirenze.local', direccion: 'Via Roma 12',
        ciudad: 'Firenze', cp: '50100', pais: 'IT',
        intracomunitario: 1, vat_number: 'IT01234567890' },
      { nombre: 'Restaurant El Racó SL', nif: 'B55554444', tipo: 'empresa',
        email: 'restaurant@elraco.local', direccion: 'Passeig de Gracia 90',
        ciudad: 'Barcelona', cp: '08008' },
      { nombre: 'Ana Torres Puig', nif: '33333333Z', tipo: 'autonomo',
        email: 'ana.torres@correo.local', direccion: 'C/ Mallorca 200',
        ciudad: 'Barcelona', cp: '08013' },
    ];
    const clienteIds = [];
    for (const c of clientes) {
      _r(`
        INSERT INTO clientes (
          empresa_id, tipo, nombre, nif, direccion, ciudad, cp, provincia,
          email, pais, intracomunitario, vat_number
        ) VALUES (
          1, :tipo, :nombre, :nif, :direccion, :ciudad, :cp, :provincia,
          :email, :pais, :intracom, :vat
        )
      `, {
        ':tipo': c.tipo, ':nombre': c.nombre, ':nif': c.nif,
        ':direccion': c.direccion || null, ':ciudad': c.ciudad || null,
        ':cp': c.cp || null, ':provincia': c.provincia || null,
        ':email': c.email || null, ':pais': c.pais || 'ES',
        ':intracom': c.intracomunitario ? 1 : 0,
        ':vat': c.vat_number || null,
      });
      clienteIds.push(_lastId());
    }

    // --- Proveedores ---
    const proveedores = [
      { nombre: 'Coworking Barcelona SL', nif: 'B77777777',
        email: 'reservas@cowork.local', iva_pct_default: 21 },
      { nombre: 'Papeleria Pons', nif: 'B66666666',
        email: 'ventas@papelpons.local', iva_pct_default: 21 },
      { nombre: 'AsesorFiscal Pro', nif: 'B33334444',
        email: 'hola@asesorpro.local', iva_pct_default: 21, irpf_pct_default: 15 },
    ];
    const proveedorIds = [];
    for (const p of proveedores) {
      _r(`
        INSERT INTO proveedores (empresa_id, nombre, nif, email,
          iva_pct_default, irpf_pct_default, pais)
        VALUES (1, :nombre, :nif, :email, :iva, :irpf, 'ES')
      `, {
        ':nombre': p.nombre, ':nif': p.nif, ':email': p.email,
        ':iva': p.iva_pct_default, ':irpf': p.irpf_pct_default || 0,
      });
      proveedorIds.push(_lastId());
    }

    // --- Productos ---
    const productos = [
      { codigo: 'CONS-1H', nombre: 'Consultoria estrategica (1 hora)',
        precio_venta: 60, precio_compra: 0, iva_pct: 21, unidad: 'h' },
      { codigo: 'CONS-4H', nombre: 'Sesion de consultoria (4 horas)',
        precio_venta: 220, precio_compra: 0, iva_pct: 21, unidad: 'ud' },
      { codigo: 'INFO-EJC', nombre: 'Informe ejecutivo PDF',
        precio_venta: 350, precio_compra: 0, iva_pct: 21, unidad: 'ud' },
      { codigo: 'DESPL', nombre: 'Desplazamiento',
        precio_venta: 40, precio_compra: 0, iva_pct: 21, unidad: 'ud' },
      { codigo: 'WORK', nombre: 'Workshop grupal (media jornada)',
        precio_venta: 480, precio_compra: 0, iva_pct: 21, unidad: 'ud' },
    ];
    for (const p of productos) {
      _r(`
        INSERT INTO productos (empresa_id, codigo, nombre,
          precio_venta, precio_unitario, precio_compra, iva_pct, unidad)
        VALUES (1, :codigo, :nombre, :venta, :venta, :compra, :iva, :unidad)
      `, {
        ':codigo': p.codigo, ':nombre': p.nombre,
        ':venta': p.precio_venta, ':compra': p.precio_compra,
        ':iva': p.iva_pct, ':unidad': p.unidad,
      });
    }

    // --- Facturas (15 aprox., ultimos 12 meses) ---
    // Distribuidas por meses recientes para que dashboards se vean con datos.
    const yy = new Date().getFullYear();
    const facturas = [
      { dias: 5,   cli: 0, estado: 'emitida',  base: 480 },
      { dias: 12,  cli: 1, estado: 'cobrada',  base: 240 },
      { dias: 25,  cli: 2, estado: 'cobrada',  base: 1100 },
      { dias: 35,  cli: 3, estado: 'emitida',  base: 350 },
      { dias: 45,  cli: 4, estado: 'cobrada',  base: 700 },
      { dias: 60,  cli: 5, estado: 'cobrada',  base: 1800, intracom: true },
      { dias: 70,  cli: 6, estado: 'cobrada',  base: 620 },
      { dias: 88,  cli: 0, estado: 'cobrada',  base: 480 },
      { dias: 110, cli: 7, estado: 'cobrada',  base: 240 },
      { dias: 145, cli: 1, estado: 'cobrada',  base: 900 },
      { dias: 175, cli: 2, estado: 'cobrada',  base: 640 },
      { dias: 210, cli: 4, estado: 'cobrada',  base: 1400 },
      { dias: 250, cli: 3, estado: 'cobrada',  base: 520 },
      { dias: 290, cli: 6, estado: 'cobrada',  base: 780 },
      { dias: 2,   cli: 0, estado: 'borrador', base: 300 },
    ];
    facturas.forEach((f, i) => {
      const fecha = _fecha(f.dias);
      const numero = `${yy}/${String(i + 1).padStart(2, '0')}`;
      const iva = f.intracom ? 0 : Math.round(f.base * 0.21 * 100) / 100;
      const total = f.base + iva;
      _r(`
        INSERT INTO facturas (
          empresa_id, numero, serie, subtipo, fecha, ciudad_emision,
          cliente_id, iva_porcentaje, base_imponible, iva_importe, total,
          estado, intracomunitario
        ) VALUES (
          1, :numero, 'A', 'factura', :fecha, 'Barcelona',
          :cli, :iva_pct, :base, :iva, :total, :estado, :intracom
        )
      `, {
        ':numero': numero, ':fecha': fecha,
        ':cli': clienteIds[f.cli],
        ':iva_pct': f.intracom ? 0 : 21,
        ':base': f.base, ':iva': iva, ':total': total,
        ':estado': f.estado, ':intracom': f.intracom ? 1 : 0,
      });
      const facturaId = _lastId();
      _r(`
        INSERT INTO lineas_factura (factura_id, orden, titulo, descripcion,
          cantidad, precio_unitario, importe)
        VALUES (:fid, 0, :titulo, :desc, 1, :importe, :importe)
      `, {
        ':fid': facturaId,
        ':titulo': ['Consultoria mes ' + (i + 1), 'Sesiones de asesoramiento',
                    'Workshop personalizado', 'Servicio profesional',
                    'Informe estratégico'][i % 5],
        ':desc': '',
        ':importe': f.base,
      });
    });

    // Actualizar contador de facturas en empresa
    _r(`UPDATE empresas SET numeracion_factura_anio = ?, numeracion_factura_siguiente = ? WHERE id = 1`,
       [yy, facturas.length + 1]);

    // --- Presupuestos ---
    const presupuestos = [
      { dias: 10,  cli: 0, estado: 'aceptado', base: 1200 },
      { dias: 20,  cli: 3, estado: 'enviado',  base: 800 },
      { dias: 35,  cli: 4, estado: 'aceptado', base: 2400 },
      { dias: 55,  cli: 5, estado: 'rechazado',base: 3000 },
      { dias: 85,  cli: 2, estado: 'convertido',base: 500 },
    ];
    presupuestos.forEach((p, i) => {
      const fecha = _fecha(p.dias);
      const numero = `${yy}/${String(i + 1).padStart(2, '0')}`;
      const iva = Math.round(p.base * 0.21 * 100) / 100;
      const total = p.base + iva;
      _r(`
        INSERT INTO presupuestos (empresa_id, numero, serie, fecha, ciudad_emision,
          cliente_id, iva_porcentaje, base_imponible, iva_importe, total, estado)
        VALUES (1, :numero, 'A', :fecha, 'Barcelona', :cli, 21, :base, :iva, :total, :estado)
      `, {
        ':numero': numero, ':fecha': fecha,
        ':cli': clienteIds[p.cli],
        ':base': p.base, ':iva': iva, ':total': total, ':estado': p.estado,
      });
      const pid = _lastId();
      _r(`
        INSERT INTO lineas_presupuesto (presupuesto_id, orden, titulo, descripcion,
          cantidad, precio_unitario, importe)
        VALUES (:pid, 0, :titulo, '', 1, :importe, :importe)
      `, {
        ':pid': pid,
        ':titulo': ['Proyecto integral consultoria',
                   'Auditoria estrategica','Programa de coaching',
                   'Rediseño de procesos','Servicio profesional'][i],
        ':importe': p.base,
      });
    });
    _r(`UPDATE empresas SET numeracion_presupuesto_anio = ?, numeracion_presupuesto_siguiente = ? WHERE id = 1`,
       [yy, presupuestos.length + 1]);

    // --- Gastos ---
    const gastos = [
      { dias: 15, prov: 0, concepto: 'Cuota mensual coworking', base: 180, iva: 21, cat: 'suministros' },
      { dias: 30, prov: 1, concepto: 'Material de oficina', base: 45, iva: 21, cat: 'oficina' },
      { dias: 45, prov: 2, concepto: 'Asesoria fiscal trimestre', base: 250, iva: 21, cat: 'asesoria', irpf: 15 },
      { dias: 60, prov: 0, concepto: 'Cuota mensual coworking', base: 180, iva: 21, cat: 'suministros' },
      { dias: 90, prov: 0, concepto: 'Cuota mensual coworking', base: 180, iva: 21, cat: 'suministros' },
      { dias: 100, prov: 1, concepto: 'Impresora + toner', base: 220, iva: 21, cat: 'oficina' },
      { dias: 125, prov: 2, concepto: 'Asesoria fiscal', base: 250, iva: 21, cat: 'asesoria', irpf: 15 },
      { dias: 150, prov: 0, concepto: 'Cuota mensual coworking', base: 180, iva: 21, cat: 'suministros' },
      { dias: 180, prov: null, concepto: 'Combustible vehiculo', base: 60, iva: 21, cat: 'vehiculo' },
      { dias: 220, prov: 2, concepto: 'Asesoria fiscal', base: 250, iva: 21, cat: 'asesoria', irpf: 15 },
    ];
    for (const g of gastos) {
      const fecha = _fecha(g.dias);
      const iva = Math.round(g.base * (g.iva / 100) * 100) / 100;
      const irpfPct = g.irpf || 0;
      const irpf = Math.round(g.base * (irpfPct / 100) * 100) / 100;
      const total = g.base + iva - irpf;
      const prov = g.prov != null ? proveedores[g.prov].nombre : 'Repsol';
      const provId = g.prov != null ? proveedorIds[g.prov] : null;
      _r(`
        INSERT INTO gastos (empresa_id, fecha, proveedor, proveedor_id,
          concepto, categoria, base_imponible, iva_pct, iva_importe,
          irpf_pct, irpf_importe, total, deducible, subtipo)
        VALUES (1, :fecha, :proveedor, :provId, :concepto, :categoria,
          :base, :iva_pct, :iva, :irpf_pct, :irpf, :total, 1, 'gasto')
      `, {
        ':fecha': fecha, ':proveedor': prov, ':provId': provId,
        ':concepto': g.concepto, ':categoria': g.cat,
        ':base': g.base, ':iva_pct': g.iva, ':iva': iva,
        ':irpf_pct': irpfPct, ':irpf': irpf, ':total': total,
      });
    }

    db.exec('COMMIT');
    return { seeded: true };
  } catch (e) {
    console.error('[seed] fallo:', e);
    db.exec('ROLLBACK');
    return { seeded: false, error: e && e.message };
  }
}
