// Plantilla "A5 Ticket" — formato A5 (media hoja), compacto. Pensada para
// negocios que emiten documentos cortos (pocas líneas) y quieren algo
// manejable tipo ticket/recibo. Tipografía pequeña, mucho menos aire que las
// plantillas A4. Misma estructura de datos que el resto: cabecera fija que
// se repite en cada página + "Página X de Y".

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import {
  TEXTO_LEGAL_DEFAULT,
  PIE_OBLIGATORIO_FACTURA,
  Watermark,
  BravaFooter,
} from '../_pdfShared.jsx';
import {
  deriveDocData,
  EmisorBlock,
  SepaQrBlock,
  ClienteContent,
  renderLineRow,
  FacturaTableHeaderCells,
  TotalsBlock,
  CalendarioPagosBlock,
  LINE_GAP_PRES,
  LINE_GAP_FAC,
  computeLineBreaks,
  PageNumberFooter,
} from './_common.jsx';

// A5 vertical: 420 x 595 pt. Márgenes ajustados para aprovechar el espacio.
const ML = 32;

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica', fontSize: 8.5, color: '#3a3a3a',
    // paddingTop reserva sitio a la cabecera absolute (acaba ~205pt).
    // paddingBottom al pie fijo (legal + pie + footer).
    paddingTop: 215, paddingBottom: 95, paddingHorizontal: ML,
  },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 6 },

  logo: {
    position: 'absolute', top: 22, left: ML,
    width: 80, height: 38, objectFit: 'contain',
  },
  titleBlock: {
    position: 'absolute', top: 24, left: ML, right: ML,
    flexDirection: 'column', alignItems: 'flex-end',
  },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, color: '#2a2a2a' },
  numero: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#5a5a5a', marginTop: 3 },

  topRow: {
    position: 'absolute', top: 78, left: ML, right: ML,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  emisorBlock: { width: 165 },
  clienteBlock: { width: 165, alignItems: 'flex-end' },
  emisorNombre: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, marginBottom: 1.5 },
  emisorLine: { fontSize: 7.5, marginBottom: 0.5, color: '#5a5a5a' },
  clienteHeader: {
    fontSize: 7, color: '#9a9a9a', letterSpacing: 1.2,
    marginBottom: 2, textTransform: 'uppercase',
  },
  clienteLine: { fontSize: 8, marginBottom: 0.5, textAlign: 'right', color: '#2a2a2a' },
  clienteWarning: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#b91c1c', textAlign: 'right' },

  fechaLine: {
    position: 'absolute', top: 160, left: ML,
    fontSize: 8, color: '#6a6a6a',
  },
  tableHeaderTopLine: {
    position: 'absolute', top: 180, left: ML, right: ML, height: 1,
  },
  tableHeader: {
    position: 'absolute', top: 188, left: ML, right: ML,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  thDesc: { fontFamily: 'Helvetica-Bold', fontSize: 8, letterSpacing: 1, color: '#3a3a3a', textTransform: 'uppercase' },
  thImp: { fontFamily: 'Helvetica-Bold', fontSize: 8, letterSpacing: 1, color: '#3a3a3a', textAlign: 'right', textTransform: 'uppercase' },

  body: {},
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  lineTitulo: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginBottom: 1.5, color: '#2a2a2a' },
  lineDesc: { fontSize: 7.5, lineHeight: 1.35, color: '#5a5a5a' },
  lineConcepto: { flex: 1, fontSize: 8, paddingRight: 10, color: '#2a2a2a' },
  lineImp: { width: 65, textAlign: 'right', fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#1a1a1a' },

  bottomBlock: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginTop: 16,
  },
  totalsBox: { width: 165 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  totalLabel: { fontSize: 8, color: '#6a6a6a' },
  totalValue: { fontSize: 8, textAlign: 'right', color: '#2a2a2a' },
  totalDivider: { height: 0.7, marginVertical: 3 },
  totalLabelBig: { fontSize: 10, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, color: '#1a1a1a' },
  totalValueBig: { fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'right', color: '#1a1a1a' },

  pieObligatorio: {
    position: 'absolute', bottom: 56, left: ML, right: ML,
    fontSize: 6, color: '#3a3a3a', textAlign: 'center',
    fontFamily: 'Helvetica-Bold', lineHeight: 1.35,
  },
  legalText: {
    position: 'absolute', bottom: 34, left: ML, right: ML,
    fontSize: 5.5, color: '#7a7a7a', textAlign: 'center', lineHeight: 1.35,
  },
  pageNumber: {
    position: 'absolute', bottom: 20, right: ML,
    fontSize: 7, color: '#9a9a9a',
  },
});

function A5Ticket({ tipo, doc, lineas, cliente, settings }) {
  const v = deriveDocData({ tipo, doc, lineas, cliente, settings });
  const lineGap = tipo === 'presupuesto' ? LINE_GAP_PRES : LINE_GAP_FAC;
  const breaks = computeLineBreaks(v.ls, v.d.modo_detallado, v.d.factura_ocultar_subitems);

  return (
    <Document>
      <Page size="A5" style={styles.page}>
        <View style={[styles.topBar, { backgroundColor: v.brandColor }]} fixed />

        {v.logoUrl ? <Image src={v.logoUrl} style={styles.logo} fixed /> : null}

        <View style={styles.titleBlock} fixed>
          <Text
            style={[
              styles.title,
              tipo === 'factura' && v.marcarBorrador ? { fontSize: 13, letterSpacing: 0.5 } : null,
              v.tituloLargo ? { fontSize: 13, letterSpacing: 0.5 } : null,
            ]}
          >
            {v.tituloDoc}
          </Text>
          <Text style={styles.numero}>{v.cabeceraNumero}</Text>
        </View>

        <View style={styles.topRow} fixed>
          <View style={styles.emisorBlock}>
            <EmisorBlock s={v.s} dirLine1={v.dirLine1} dirLine2={v.dirLine2} styles={styles} firmaUrl={v.firmaUrl} />
          </View>
          <View style={styles.clienteBlock}>
            <Text style={styles.clienteHeader}>{v.L.cliente_header.replace(':', '')}</Text>
            <ClienteContent
              tipo={tipo}
              cliente={cliente}
              cpCiudad={v.cpCiudad}
              asuntoFallback={v.d.asunto}
              styles={styles}
            />
          </View>
        </View>

        <Text style={styles.fechaLine} fixed>{v.fechaTxt}</Text>

        <View style={[styles.tableHeaderTopLine, { backgroundColor: v.brandColor }]} fixed />
        <View style={styles.tableHeader} fixed>
          {tipo === 'factura' ? (
            <FacturaTableHeaderCells styles={styles} tableHeaderLeft={v.tableHeaderLeft} L={v.L} />
          ) : (
            <>
              <Text style={styles.thDesc}>{v.tableHeaderLeft}</Text>
              <Text style={styles.thImp}>{v.L.importe}</Text>
            </>
          )}
        </View>

        <View style={styles.body}>
          {v.ls.map((l, i) => (
            <View key={`row-${i}`} style={{ marginBottom: lineGap * 0.7 }} wrap={false} break={breaks.has(i)}>
              {renderLineRow(tipo, l, i, styles, v.d.modo_detallado, v.d.factura_ocultar_subitems)}
            </View>
          ))}
          <CalendarioPagosBlock
            hitos={v.hitos}
            base={v.base}
            brandColor={v.brandColor}
          />

          <View style={styles.bottomBlock} wrap={false}>
            <SepaQrBlock qrDataUrl={v.qrDataUrl} />
            <View style={styles.totalsBox}>
              <TotalsBlock {...v} styles={styles} dividerColor={v.brandColor} />
            </View>
          </View>
        </View>

        {tipo === 'factura' && v.marcarBorrador ? (
          <Text style={styles.pieObligatorio} fixed>{PIE_OBLIGATORIO_FACTURA}</Text>
        ) : null}
        <Text style={styles.legalText} fixed>
          {v.s.texto_legal || TEXTO_LEGAL_DEFAULT}
        </Text>
        <BravaFooter fixed />
        <PageNumberFooter style={styles.pageNumber} />

        {tipo === 'factura' && v.marcarBorrador ? <Watermark /> : null}
      </Page>
    </Document>
  );
}

export default A5Ticket;
