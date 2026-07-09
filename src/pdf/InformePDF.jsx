// PDF "Informe del periodo" — version imprimible del dashboard, parametrizable
// por rango de fechas (trimestre, anyo, custom). Recibe el objeto que devuelve
// home_informe del repository ya con todos los agregados precomputados.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import {
  PAGE_W,
  PAGE_H,
  BravaFooter,
} from './_pdfShared.jsx';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1f2937',
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 50,
  },

  // Cabecera
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', marginBottom: 20,
  },
  titulo: {
    fontFamily: 'Helvetica-Bold', fontSize: 22,
    letterSpacing: 1, color: '#111827',
  },
  subtitulo: { fontSize: 10, color: '#6b7280', marginTop: 4 },
  emisorBlock: { textAlign: 'right' },
  emisorNombre: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, color: '#111827' },
  emisorLine: { fontSize: 9, color: '#6b7280', marginTop: 1 },

  bandaColor: { height: 3, marginBottom: 18 },

  // Stats grandes (4 tiles)
  statsRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginBottom: 18, gap: 8,
  },
  statTile: {
    width: '24%',
    padding: 10,
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4,
  },
  statLabel: { fontSize: 8.5, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontFamily: 'Helvetica-Bold', fontSize: 14, marginTop: 4, color: '#111827' },
  statHint: { fontSize: 8, color: '#9ca3af', marginTop: 2 },

  // Secciones
  sectionTitle: {
    fontFamily: 'Helvetica-Bold', fontSize: 11,
    letterSpacing: 1, color: '#374151',
    textTransform: 'uppercase', marginBottom: 8, marginTop: 6,
  },

  // Tabla mensual
  tableRow: {
    flexDirection: 'row', paddingVertical: 4,
    borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb',
  },
  tableRowHead: {
    flexDirection: 'row', paddingVertical: 5,
    borderBottomWidth: 1, borderBottomColor: '#9ca3af',
  },
  thMes:   { flex: 2, fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#374151' },
  thCount: { flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#374151', textAlign: 'right' },
  thTotal: { flex: 2, fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#374151', textAlign: 'right' },
  tdMes:   { flex: 2, fontSize: 9.5, color: '#1f2937' },
  tdCount: { flex: 1, fontSize: 9.5, textAlign: 'right', color: '#1f2937' },
  tdTotal: { flex: 2, fontSize: 9.5, textAlign: 'right', color: '#1f2937' },
  tdMesEmpty: { color: '#9ca3af' },

  // Bar chart simple (mensual)
  chartBox: { marginBottom: 22 },
  chartLayout: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 4, marginBottom: 4 },
  bar: { flex: 1, backgroundColor: '#3b82f6', borderRadius: 1 },
  chartLabels: { flexDirection: 'row', gap: 4 },
  chartLabel: { flex: 1, fontSize: 7, color: '#6b7280', textAlign: 'center' },

  // Top clientes
  cliRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb',
  },
  cliNombre: { flex: 3, fontSize: 10, color: '#1f2937' },
  cliFacturas: { flex: 1, fontSize: 9, color: '#6b7280', textAlign: 'right' },
  cliTotal: { flex: 2, fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'right', color: '#1f2937' },

  // Listado facturas
  fRow: {
    flexDirection: 'row', paddingVertical: 3,
    borderBottomWidth: 0.5, borderBottomColor: '#f3f4f6',
  },
  fNum:    { flex: 2, fontSize: 9, color: '#1f2937' },
  fFecha:  { flex: 2, fontSize: 9, color: '#6b7280' },
  fCli:    { flex: 4, fontSize: 9, color: '#1f2937' },
  fTotal:  { flex: 2, fontSize: 9, color: '#1f2937', textAlign: 'right' },
  fEstado: { flex: 1, fontSize: 8, color: '#6b7280', textAlign: 'right', textTransform: 'uppercase' },

  // Resumen al final
  resumenBox: {
    marginTop: 14, padding: 10,
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4,
    backgroundColor: '#f9fafb',
  },
  resumenRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  resumenLabel: { fontSize: 9.5, color: '#374151' },
  resumenValue: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#111827' },

  pageNumber: {
    position: 'absolute', bottom: 30, right: 50,
    fontSize: 8, color: '#9ca3af',
  },
});

const MESES_LARGO = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function formatEUR(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

function formatFecha(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function mesLabel(ym) {
  const [y, m] = ym.split('-');
  return `${MESES_LARGO[parseInt(m, 10) - 1]} ${y}`;
}

function InformePDF({ informe, settings }) {
  const { rango, agregados, mensual, top_clientes, facturas } = informe;
  const brandColor = settings?.brand_color || '#1abc9c';
  const maxMensual = Math.max(1, ...mensual.map((m) => m.total));

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* Cabecera */}
        <View style={styles.header}>
          <View>
            <Text style={styles.titulo}>INFORME DEL PERIODO</Text>
            <Text style={styles.subtitulo}>
              {formatFecha(rango.desde)} — {formatFecha(rango.hasta)}
            </Text>
          </View>
          <View style={styles.emisorBlock}>
            {settings?.emisor_nombre && (
              <Text style={styles.emisorNombre}>{settings.emisor_nombre}</Text>
            )}
            {settings?.emisor_nif && (
              <Text style={styles.emisorLine}>NIF: {settings.emisor_nif}</Text>
            )}
            {settings?.emisor_email && (
              <Text style={styles.emisorLine}>{settings.emisor_email}</Text>
            )}
            <Text style={[styles.emisorLine, { marginTop: 4 }]}>
              Generado el {formatFecha(new Date().toISOString().slice(0, 10))}
            </Text>
          </View>
        </View>

        <View style={[styles.bandaColor, { backgroundColor: brandColor }]} />

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>Facturado</Text>
            <Text style={styles.statValue}>{formatEUR(agregados.total)}</Text>
            <Text style={styles.statHint}>{agregados.n_facturas} facturas</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>Cobrado</Text>
            <Text style={styles.statValue}>{formatEUR(agregados.cobrado)}</Text>
            <Text style={styles.statHint}>
              {agregados.total > 0
                ? `${Math.round((agregados.cobrado / agregados.total) * 100)}% del facturado`
                : '—'}
            </Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>Pendiente</Text>
            <Text style={styles.statValue}>{formatEUR(agregados.pendiente)}</Text>
            <Text style={styles.statHint}>facturado - cobrado</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>Beneficio est.</Text>
            <Text style={styles.statValue}>{formatEUR(agregados.beneficio_estimado)}</Text>
            <Text style={styles.statHint}>base - gastos deducibles</Text>
          </View>
        </View>

        {/* Resumen ingresos / gastos */}
        <View style={styles.resumenBox}>
          <View style={styles.resumenRow}>
            <Text style={styles.resumenLabel}>Base imponible facturada:</Text>
            <Text style={styles.resumenValue}>{formatEUR(agregados.base)}</Text>
          </View>
          <View style={styles.resumenRow}>
            <Text style={styles.resumenLabel}>IVA repercutido:</Text>
            <Text style={styles.resumenValue}>{formatEUR(agregados.iva)}</Text>
          </View>
          <View style={styles.resumenRow}>
            <Text style={styles.resumenLabel}>
              Gastos deducibles ({agregados.n_gastos}):
            </Text>
            <Text style={styles.resumenValue}>
              {formatEUR(agregados.gastos_base)} base · {formatEUR(agregados.gastos_iva)} IVA
            </Text>
          </View>
        </View>

        {/* Mini grafica mensual */}
        {mensual.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
              Facturado por mes
            </Text>
            <View style={styles.chartBox}>
              <View style={styles.chartLayout}>
                {mensual.map((m) => {
                  const h = (m.total / maxMensual) * 80;
                  return (
                    <View
                      key={m.ym}
                      style={[
                        styles.bar,
                        { height: Math.max(1, h), backgroundColor: brandColor },
                      ]}
                    />
                  );
                })}
              </View>
              <View style={styles.chartLabels}>
                {mensual.map((m) => (
                  <Text key={m.ym} style={styles.chartLabel}>
                    {m.ym.slice(5, 7)}/{m.ym.slice(2, 4)}
                  </Text>
                ))}
              </View>
            </View>
            <View style={styles.tableRowHead}>
              <Text style={styles.thMes}>Mes</Text>
              <Text style={styles.thCount}>Facturas</Text>
              <Text style={styles.thTotal}>Total</Text>
            </View>
            {mensual.map((m) => (
              <View style={styles.tableRow} key={m.ym}>
                <Text style={[styles.tdMes, m.count === 0 && styles.tdMesEmpty]}>
                  {mesLabel(m.ym)}
                </Text>
                <Text style={styles.tdCount}>{m.count}</Text>
                <Text style={styles.tdTotal}>{formatEUR(m.total)}</Text>
              </View>
            ))}
          </>
        )}

        {/* Top clientes */}
        {top_clientes.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Top clientes del periodo</Text>
            {top_clientes.map((c) => (
              <View style={styles.cliRow} key={c.id}>
                <Text style={styles.cliNombre}>{c.nombre}</Text>
                <Text style={styles.cliFacturas}>
                  {c.facturas} factura{c.facturas !== 1 ? 's' : ''}
                </Text>
                <Text style={styles.cliTotal}>{formatEUR(c.total)}</Text>
              </View>
            ))}
          </>
        )}

        {/* Listado de facturas del periodo */}
        {facturas.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Facturas del periodo</Text>
            <View style={styles.tableRowHead}>
              <Text style={styles.fNum}>Numero</Text>
              <Text style={styles.fFecha}>Fecha</Text>
              <Text style={styles.fCli}>Cliente</Text>
              <Text style={[styles.fTotal, { fontFamily: 'Helvetica-Bold' }]}>Total</Text>
              <Text style={[styles.fEstado, { fontFamily: 'Helvetica-Bold' }]}>Estado</Text>
            </View>
            {facturas.map((f) => (
              <View style={styles.fRow} key={f.id} wrap={false}>
                <Text style={styles.fNum}>{f.numero}</Text>
                <Text style={styles.fFecha}>{formatFecha(f.fecha)}</Text>
                <Text style={styles.fCli}>{f.cliente}</Text>
                <Text style={styles.fTotal}>{formatEUR(f.total)}</Text>
                <Text style={styles.fEstado}>{f.estado}</Text>
              </View>
            ))}
          </>
        )}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
        <BravaFooter />
      </Page>
    </Document>
  );
}

export default InformePDF;
