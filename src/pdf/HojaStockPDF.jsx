// v1.5.0: PDF "Hoja de stock actualizado" de un deposito.
//
// Layout simple: cabecera con nombre del deposito, cliente y fecha; tabla
// con productos + stock actual + precio medio + valor. Pie con total.
// Pensado para adjuntar al email de la factura mensual a la tienda.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { formatEUR, formatFechaES } from '../utils/format.js';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#111',
  },
  header: { marginBottom: 20 },
  title: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 20,
    letterSpacing: 1,
    color: '#1abc9c',
    marginBottom: 4,
  },
  subtitle: { fontSize: 11, color: '#555' },
  meta: { marginTop: 8, fontSize: 10, color: '#333' },
  metaLabel: { fontFamily: 'Helvetica-Bold', color: '#666' },
  tableHead: {
    flexDirection: 'row',
    borderTop: '1px solid #1abc9c',
    borderBottom: '1px solid #1abc9c',
    paddingVertical: 5,
    marginTop: 15,
  },
  th: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    letterSpacing: 0.5,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    borderBottom: '0.5px solid #eee',
    paddingVertical: 6,
  },
  totalRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 8,
    borderTop: '1px solid #1abc9c',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#999',
    textAlign: 'center',
  },
});

export function HojaStockPDF({ deposito, stock, appName, appVersion }) {
  const fechaHoy = formatFechaES(new Date().toISOString().slice(0, 10));
  const total = (stock || []).reduce(
    (s, x) => s + (Number(x.cantidad_actual) || 0) * (Number(x.precio_unitario_medio) || 0),
    0,
  );
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>HOJA DE STOCK</Text>
          <Text style={styles.subtitle}>{deposito?.nombre || ''}</Text>
          <View style={styles.meta}>
            <Text>
              <Text style={styles.metaLabel}>Cliente: </Text>
              {deposito?.cliente_nombre || '—'}
            </Text>
            <Text>
              <Text style={styles.metaLabel}>Fecha del listado: </Text>
              {fechaHoy}
            </Text>
          </View>
        </View>

        <View style={styles.tableHead}>
          <Text style={[styles.th, { width: 60 }]}>CÓDIGO</Text>
          <Text style={[styles.th, { flex: 1 }]}>PRODUCTO</Text>
          <Text style={[styles.th, { width: 50, textAlign: 'right' }]}>CANTIDAD</Text>
          <Text style={[styles.th, { width: 65, textAlign: 'right' }]}>PRECIO U.</Text>
          <Text style={[styles.th, { width: 65, textAlign: 'right' }]}>VALOR</Text>
        </View>

        {(stock || []).map((s, i) => (
          <View key={i} style={styles.row}>
            <Text style={{ width: 60, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#666' }}>
              {s.codigo || '—'}
            </Text>
            <Text style={{ flex: 1, fontSize: 10 }}>
              {s.nombre_en || s.concepto || '—'}
            </Text>
            <Text style={{ width: 50, textAlign: 'right', fontSize: 10 }}>
              {Number(s.cantidad_actual).toFixed(2)}
            </Text>
            <Text style={{ width: 65, textAlign: 'right', fontSize: 10, color: '#555' }}>
              {formatEUR(s.precio_unitario_medio)}
            </Text>
            <Text style={{ width: 65, textAlign: 'right', fontSize: 10, fontFamily: 'Helvetica-Bold' }}>
              {formatEUR((Number(s.cantidad_actual) || 0) * (Number(s.precio_unitario_medio) || 0))}
            </Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={{ flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 11 }}>VALOR TOTAL DEL STOCK</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 12, color: '#1abc9c' }}>
            {formatEUR(total)}
          </Text>
        </View>

        <Text style={styles.footer} fixed>
          {`${appName || 'Ruyx Office'} · v${appVersion || ''} · Documento informativo — el stock refleja los movimientos registrados hasta la fecha del listado.`}
        </Text>
      </Page>
    </Document>
  );
}

export default HojaStockPDF;
