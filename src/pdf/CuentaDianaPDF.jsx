// PDF "Cuenta interna de Diana" — version imprimible de la pagina /diana.
// Recibe el objeto que devuelve informes_diana del repository ya con todos
// los totales calculados, ademas de meta (empresa nombre + saldo inicial).
//
// Layout (1 sola pagina, A4 vertical, salto natural si la tabla pasa):
//   - Header: titulo + subtitulo con rango de fechas y empresa.
//   - 4 cards de totales (ventas cobradas / pendientes / gastos / pagos).
//   - 3 cards de saldos (arrastrado / del periodo / SALDO ACTUAL).
//   - Tabla de movimientos del periodo.
//   - Footer: "Vista interna, NO fiscal" + fecha de generacion.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { formatEUR, formatFechaES } from '../utils/format.js';

const FUCHSIA = '#a21caf';
const FUCHSIA_BG = '#fdf4ff';
const EMERALD = '#047857';
const EMERALD_BG = '#ecfdf5';
const AMBER = '#b45309';
const AMBER_BG = '#fffbeb';
const RED = '#b91c1c';
const RED_BG = '#fef2f2';
const VIOLET = '#6d28d9';
const VIOLET_BG = '#f5f3ff';
const SKY = '#0369a1';
const SKY_BG = '#f0f9ff';
const SLATE_TXT = '#1f2937';
const SLATE_DIM = '#6b7280';
const SLATE_LINE = '#e5e7eb';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: SLATE_TXT,
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 36,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', marginBottom: 14,
  },
  titulo: {
    fontFamily: 'Helvetica-Bold', fontSize: 18,
    letterSpacing: 0.5, color: FUCHSIA,
  },
  subtitulo: { fontSize: 9, color: SLATE_DIM, marginTop: 3 },
  empresaBlock: { textAlign: 'right' },
  empresaNombre: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: SLATE_TXT },
  empresaLine: { fontSize: 8.5, color: SLATE_DIM, marginTop: 1 },
  banda: { height: 2, backgroundColor: FUCHSIA, marginBottom: 12, opacity: 0.7 },

  cardsRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginBottom: 8, gap: 6,
  },
  card: {
    borderWidth: 1, borderRadius: 4,
    padding: 8,
  },
  cardSm: { width: '24%' },
  cardMd: { width: '32%' },
  cardLabel: { fontSize: 7.5, textTransform: 'uppercase', letterSpacing: 0.4 },
  cardValue: { fontFamily: 'Helvetica-Bold', fontSize: 13, marginTop: 3 },
  cardValueBig: { fontFamily: 'Helvetica-Bold', fontSize: 16, marginTop: 3 },
  cardHint: { fontSize: 7.5, marginTop: 2, opacity: 0.7 },

  sectionTitle: {
    fontFamily: 'Helvetica-Bold', fontSize: 10,
    letterSpacing: 0.6, color: '#374151',
    textTransform: 'uppercase', marginBottom: 6, marginTop: 10,
  },

  tableHead: {
    flexDirection: 'row', paddingVertical: 4,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1, borderBottomColor: '#9ca3af',
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row', paddingVertical: 3.5,
    borderBottomWidth: 0.5, borderBottomColor: SLATE_LINE,
    paddingHorizontal: 4,
  },
  thFecha:   { width: 70, fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: '#374151' },
  thTipo:    { width: 50, fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: '#374151' },
  thConcepto:{ flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: '#374151' },
  thBase:    { width: 65, fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: '#374151', textAlign: 'right' },
  thDiana:   { width: 65, fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: '#374151', textAlign: 'right' },
  thEstado:  { width: 60, fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: '#374151' },
  tdFecha:   { width: 70, fontSize: 9, color: SLATE_TXT },
  tdTipo:    { width: 50, fontSize: 8.5 },
  tdConcepto:{ fontSize: 9, color: SLATE_TXT },
  tdBase:    { width: 65, fontSize: 9, textAlign: 'right', color: SLATE_DIM, fontFamily: 'Helvetica' },
  tdDiana:   { width: 65, fontSize: 9, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  tdEstado:  { width: 60, fontSize: 8.5 },
  badge: {
    paddingHorizontal: 4, paddingVertical: 1.5,
    borderRadius: 2, fontSize: 7.5, textTransform: 'uppercase',
    alignSelf: 'flex-start',
  },

  footer: {
    position: 'absolute',
    bottom: 18, left: 36, right: 36,
    flexDirection: 'row', justifyContent: 'space-between',
    fontSize: 7.5, color: '#9ca3af',
  },
});

function Card({ label, value, hint, color, bg, big }) {
  return (
    <View style={[
      styles.card, big ? styles.cardMd : styles.cardSm,
      { backgroundColor: bg, borderColor: color },
    ]}>
      <Text style={[styles.cardLabel, { color }]}>{label}</Text>
      <Text style={[big ? styles.cardValueBig : styles.cardValue, { color }]}>
        {formatEUR(value)}
      </Text>
      {hint && <Text style={[styles.cardHint, { color }]}>{hint}</Text>}
    </View>
  );
}

function TipoBadge({ tipo, socioNombre }) {
  if (tipo === 'venta') return <Text style={[styles.badge, { backgroundColor: EMERALD_BG, color: EMERALD }]}>Venta</Text>;
  if (tipo === 'gasto') return <Text style={[styles.badge, { backgroundColor: RED_BG, color: RED }]}>Gasto</Text>;
  if (tipo === 'pago_diana' || tipo === 'pago_socio') {
    const label = socioNombre ? `Pago ${(socioNombre || '?')[0].toUpperCase()}.` : 'Pago';
    return <Text style={[styles.badge, { backgroundColor: VIOLET_BG, color: VIOLET }]}>{label}</Text>;
  }
  if (tipo === 'movimiento') return <Text style={[styles.badge, { backgroundColor: SKY_BG, color: SKY }]}>Movim.</Text>;
  return <Text> </Text>;
}

function EstadoBadge({ fila }) {
  if (fila.tipo !== 'venta') return <Text> </Text>;
  if (fila.realizado) {
    return <Text style={[styles.badge, { backgroundColor: EMERALD_BG, color: EMERALD }]}>Cobrada</Text>;
  }
  return <Text style={[styles.badge, { backgroundColor: AMBER_BG, color: AMBER }]}>Pendiente</Text>;
}

function CuentaDianaPDF({ informe, meta }) {
  const { desde, hasta, filas, totales } = informe || {};
  const empresa = meta?.empresa || {};
  const saldoInicial = meta?.saldoInicial || 0;
  // v1.5.0: nombre dinamico del socio. Fallback a "Diana" para PDFs viejos
  // generados sin este campo. `informe.socio_nombre` viene de informes_socio.
  const socioNombre = meta?.socioNombre || informe?.socio_nombre || 'Diana';
  void saldoInicial;
  const fechaGen = new Date().toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  // Compatibilidad: el field puede llegar como `socio_importe` (nuevo) o
  // `diana_importe` (viejo). Preferimos socio_importe si existe.
  const getImp = (f) => (typeof f?.socio_importe === 'number' ? f.socio_importe : (Number(f?.diana_importe) || 0));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.titulo}>Cuenta interna de {socioNombre}</Text>
            <Text style={styles.subtitulo}>
              Periodo: {formatFechaES(desde)} – {formatFechaES(hasta)}
            </Text>
            <Text style={styles.subtitulo}>
              Vista interna, NO fiscal. Liquidación de la comisión.
            </Text>
          </View>
          <View style={styles.empresaBlock}>
            {empresa.nombre && <Text style={styles.empresaNombre}>{empresa.nombre}</Text>}
            {empresa.nif && <Text style={styles.empresaLine}>NIF: {empresa.nif}</Text>}
          </View>
        </View>
        <View style={styles.banda} />

        <View style={styles.cardsRow}>
          <Card
            label="Ventas (cobradas)"
            value={totales?.ventas_realizado || 0}
            hint="Ya cobrado este periodo"
            color={EMERALD}
            bg={EMERALD_BG}
          />
          <Card
            label="Ventas pendientes"
            value={totales?.ventas_pendiente || 0}
            hint="Aún no cobradas — no entran en el saldo"
            color={AMBER}
            bg={AMBER_BG}
          />
          <Card
            label="Gastos compartidos"
            value={totales?.compras_realizado || 0}
            hint="Impacto neto sobre el saldo"
            color={RED}
            bg={RED_BG}
          />
          <Card
            label={`Pagos a ${socioNombre}`}
            value={-(totales?.pagos_realizados || 0)}
            hint={`Ya pagado a ${socioNombre}`}
            color={VIOLET}
            bg={VIOLET_BG}
          />
        </View>

        <View style={styles.cardsRow}>
          <Card
            label="Saldo arrastrado"
            value={totales?.saldo_arrastrado || 0}
            hint="Saldo al final del periodo anterior"
            color="#475569"
            bg="#f8fafc"
            big
          />
          <Card
            label="Saldo del periodo"
            value={totales?.saldo_periodo || 0}
            hint="Solo movimientos cobrados"
            color="#475569"
            bg="#f8fafc"
            big
          />
          <Card
            label="SALDO ACTUAL"
            value={totales?.saldo_final || 0}
            hint={`Positivo = le debes a ${socioNombre}`}
            color={FUCHSIA}
            bg={FUCHSIA_BG}
            big
          />
        </View>

        <Text style={styles.sectionTitle}>Movimientos del periodo</Text>
        {(!filas || filas.length === 0) ? (
          <Text style={{ fontSize: 10, color: SLATE_DIM, paddingVertical: 12 }}>
            No hay movimientos de {socioNombre} en este periodo.
          </Text>
        ) : (
          <View>
            <View style={styles.tableHead} fixed>
              <Text style={styles.thFecha}>Fecha</Text>
              <Text style={styles.thTipo}>Tipo</Text>
              <Text style={styles.thConcepto}>Concepto</Text>
              <Text style={styles.thBase}>Base</Text>
              <Text style={styles.thDiana}>{socioNombre}</Text>
              <Text style={styles.thEstado}>Estado</Text>
            </View>
            {filas.map((f, idx) => {
              const imp = getImp(f);
              return (
                <View
                  key={`${f.tipo}-${f.ref_id}-${idx}`}
                  style={[styles.tableRow, { alignItems: 'flex-start' }]}
                >
                  <Text style={styles.tdFecha}>{formatFechaES(f.fecha)}</Text>
                  <View style={styles.tdTipo}><TipoBadge tipo={f.tipo} socioNombre={socioNombre} /></View>
                  <View style={{ flex: 1, paddingRight: 4, flexDirection: 'column' }}>
                    <Text style={styles.tdConcepto}>
                      {f.ref_numero ? `${f.ref_numero} · ` : ''}{f.concepto || '—'}
                    </Text>
                    {f.notas ? (
                      <Text style={{ fontSize: 8, color: SLATE_DIM, fontStyle: 'italic', marginTop: 1 }}>
                        {f.notas}
                      </Text>
                    ) : null}
                    {f.tipo === 'venta' && f.realizado && f.fecha_emision && f.fecha_emision !== f.fecha ? (
                      <Text style={{ fontSize: 7.5, color: '#9ca3af', marginTop: 1 }}>
                        Emitida {formatFechaES(f.fecha_emision)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.tdBase}>
                    {(f.tipo === 'pago_diana' || f.tipo === 'pago_socio') ? '' : formatEUR(f.base_imponible || 0)}
                  </Text>
                  <Text style={[styles.tdDiana, {
                    color: imp >= 0 ? EMERALD : RED,
                  }]}>
                    {formatEUR(imp)}
                  </Text>
                  <View style={styles.tdEstado}><EstadoBadge fila={f} /></View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>Cuenta interna de {socioNombre} — Vista interna, NO fiscal.</Text>
          <Text>Generado: {fechaGen}</Text>
        </View>
      </Page>
    </Document>
  );
}

export default CuentaDianaPDF;
