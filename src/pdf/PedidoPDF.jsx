// PDF de un pedido a proveedor. Documento NO fiscal — formato A4 con
// cabecera con logo + datos de emisor (empresa que pide), bloque
// destinatario (proveedor), tabla de lineas con columnas
// CONCEPTO / CANTIDAD / PRECIO U. / IMPORTE, total al final.
// Estilo intencionalmente sobrio (sin marca de plantilla) — el pedido
// es interno y se imprime/envia al proveedor para confirmar.

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { formatEUR, formatFechaES } from '../utils/format.js';

const ML = 40;
const MR = 40;

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica', fontSize: 10, color: '#3a3a3a',
    paddingTop: 50, paddingBottom: 60, paddingLeft: ML, paddingRight: MR,
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 20,
  },
  emisorBlock: { width: 250 },
  logo: { maxWidth: 110, maxHeight: 55, objectFit: 'contain', marginBottom: 8 },
  emisorNombre: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginBottom: 2 },
  emisorLine: { fontSize: 9.5, color: '#3a3a3a', marginBottom: 1 },
  titleBlock: { alignItems: 'flex-end' },
  title: {
    fontSize: 18, fontFamily: 'Helvetica-Bold',
    letterSpacing: 2, color: '#2a2a2a',
  },
  numero: { fontSize: 10, color: '#5a5a5a', marginTop: 4 },
  fechaLine: { fontSize: 9.5, color: '#5a5a5a', marginTop: 2 },

  proveedorBox: {
    marginTop: 8, marginBottom: 22, padding: 10,
    backgroundColor: '#f8fafc',
    borderLeftWidth: 3, borderLeftColor: '#1abc9c',
  },
  proveedorHeader: {
    fontSize: 8, color: '#5a5a5a', letterSpacing: 1.5,
    textTransform: 'uppercase', marginBottom: 3,
  },
  proveedorNombre: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#2a2a2a' },

  tableHeaderTop: { height: 1, backgroundColor: '#2a2a2a', marginBottom: 8 },
  tableHeader: {
    flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6,
  },
  th: {
    fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#2a2a2a',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  tableHeaderBot: { height: 0.6, backgroundColor: '#bdbdbd', marginBottom: 6 },

  lineRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 8,
  },
  lineConcepto: { flex: 1, fontSize: 9.5, color: '#2a2a2a', paddingRight: 8 },
  lineCant: { width: 40, textAlign: 'right', fontSize: 9.5, color: '#3a3a3a' },
  linePrecio: { width: 65, textAlign: 'right', fontSize: 9.5, color: '#3a3a3a' },
  lineDto: { width: 55, textAlign: 'right', fontSize: 9.5, color: '#3a3a3a' },
  lineImp: { width: 75, textAlign: 'right', fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#1a1a1a' },

  totalsRow: {
    flexDirection: 'row', justifyContent: 'flex-end',
    marginTop: 18,
  },
  totalsBox: { width: 220 },
  totalLine: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3,
  },
  totalLabel: { fontSize: 10, color: '#5a5a5a' },
  totalValue: { fontSize: 10, color: '#2a2a2a', textAlign: 'right' },
  totalDivider: { height: 1, backgroundColor: '#2a2a2a', marginVertical: 4 },
  totalLabelBig: {
    fontSize: 12, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8, color: '#1a1a1a',
  },
  totalValueBig: {
    fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'right', color: '#1a1a1a',
  },

  notasBlock: { marginTop: 24 },
  notasHeader: {
    fontSize: 8, color: '#5a5a5a', letterSpacing: 1.5,
    textTransform: 'uppercase', marginBottom: 4,
  },
  notasText: { fontSize: 9, color: '#2a2a2a', lineHeight: 1.4 },

  footer: {
    position: 'absolute', bottom: 24, left: ML, right: MR,
    fontSize: 7, color: '#9a9a9a', textAlign: 'center',
  },
});

function PedidoPDF({ pedido, lineas, settings }) {
  const s = settings || {};
  const ls = Array.isArray(lineas) ? lineas : [];
  const dirParts = [s.emisor_direccion, [s.emisor_cp, s.emisor_ciudad].filter(Boolean).join(' '), s.emisor_pais]
    .filter((x) => x && String(x).trim());

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow} fixed>
          <View style={styles.emisorBlock}>
            {s.logo_data_url ? (
              <Image src={s.logo_data_url} style={styles.logo} />
            ) : null}
            {s.emisor_nombre ? (
              <Text style={styles.emisorNombre}>{s.emisor_nombre}</Text>
            ) : null}
            {s.emisor_nif ? (
              <Text style={styles.emisorLine}>{`VAT ${s.emisor_nif}`}</Text>
            ) : null}
            {dirParts.map((d, i) => (
              <Text key={`dir-${i}`} style={styles.emisorLine}>{d}</Text>
            ))}
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>PEDIDO</Text>
            <Text style={styles.numero}>{`Nº ${pedido.numero || ''}`}</Text>
            <Text style={styles.fechaLine}>{formatFechaES(pedido.fecha)}</Text>
          </View>
        </View>

        {pedido.proveedor ? (
          <View style={styles.proveedorBox}>
            <Text style={styles.proveedorHeader}>Para</Text>
            <Text style={styles.proveedorNombre}>{pedido.proveedor}</Text>
          </View>
        ) : null}

        <View style={styles.tableHeaderTop} />
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 1 }]}>CONCEPTO</Text>
          <Text style={[styles.th, { width: 40, textAlign: 'right' }]}>UNID.</Text>
          <Text style={[styles.th, { width: 65, textAlign: 'right' }]}>PRECIO U.</Text>
          <Text style={[styles.th, { width: 55, textAlign: 'right' }]}>DTO</Text>
          <Text style={[styles.th, { width: 75, textAlign: 'right' }]}>IMPORTE</Text>
        </View>
        <View style={styles.tableHeaderBot} />

        {ls.map((l, i) => {
          const tit = (l.titulo || '').trim();
          const desc = (l.descripcion || '').trim();
          const concepto = tit || desc || '—';
          const descBajo = tit && desc ? desc : null;
          const cant = Number(l.cantidad) || 1;
          const precio = Number(l.precio_unitario) || 0;
          const dtoVal = Number(l.descuento_valor) || 0;
          const dtoTipo = l.descuento_tipo === 'eur' ? 'eur' : 'pct';
          let dtoStr = '—';
          if (dtoVal > 0) {
            dtoStr = dtoTipo === 'eur'
              ? `-${formatEUR(dtoVal)}`
              : `-${dtoVal}%`;
          }
          return (
            <View key={l.id ?? i} style={styles.lineRow} wrap={false}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.lineConcepto, { fontFamily: 'Helvetica-Bold' }]}>{concepto}</Text>
                {descBajo ? (
                  <Text style={{ fontSize: 8.5, color: '#5a5a5a', marginTop: 1, lineHeight: 1.35 }}>
                    {descBajo}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.lineCant}>{cant}</Text>
              <Text style={styles.linePrecio}>{formatEUR(precio)}</Text>
              <Text style={[styles.lineDto, dtoVal > 0 ? { color: '#b45309' } : { color: '#94a3b8' }]}>{dtoStr}</Text>
              <Text style={styles.lineImp}>{formatEUR(l.importe)}</Text>
            </View>
          );
        })}

        <View style={styles.totalsRow}>
          <View style={styles.totalsBox}>
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>BASE IMPONIBLE</Text>
              <Text style={styles.totalValue}>{formatEUR(pedido.base_imponible || 0)}</Text>
            </View>
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>{`IVA ${Number(pedido.iva_porcentaje) || 0}%`}</Text>
              <Text style={styles.totalValue}>{formatEUR(pedido.iva_importe || 0)}</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.totalLine}>
              <Text style={styles.totalLabelBig}>TOTAL</Text>
              <Text style={styles.totalValueBig}>{formatEUR(pedido.total || 0)}</Text>
            </View>
          </View>
        </View>

        {pedido.notas ? (
          <View style={styles.notasBlock}>
            <Text style={styles.notasHeader}>NOTAS</Text>
            <Text style={styles.notasText}>{pedido.notas}</Text>
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          Documento no fiscal. Pedido orientativo a proveedor.
        </Text>
      </Page>
    </Document>
  );
}

export default PedidoPDF;
