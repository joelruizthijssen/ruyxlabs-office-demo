// Plantilla "Minimal" — diseno editorial, sin bandas. Solo dos lineas finas
// en color principal (arriba/abajo) y acentos sutiles en los divisores. Mucho
// aire blanco, tipografia tranquila. Pensada para cuando el cliente prefiere
// un look serio y discreto.

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import {
  PAGE_W,
  MARGIN_X,
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

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica', fontSize: 10, color: '#3a3a3a',
    paddingTop: 380, paddingBottom: 105, paddingHorizontal: MARGIN_X,
  },

  topLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  bottomLine: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3 },

  // Logo grande para aprovechar el espacio en blanco. Lateral izquierdo,
  // titulo alineado al lateral derecho a la misma altura.
  logo: {
    position: 'absolute', top: 55, left: MARGIN_X,
    width: 180, height: 90, objectFit: 'contain',
  },

  titleBlock: {
    position: 'absolute', top: 80, left: MARGIN_X, right: MARGIN_X,
    flexDirection: 'column', alignItems: 'flex-end',
  },
  // v1.2.38: title 36 -> 22 (madre pidio "logo > FACTURA").
  title: { fontSize: 22, color: '#2a2a2a', letterSpacing: 3 },
  numero: {
    fontSize: 11, fontFamily: 'Helvetica', letterSpacing: 1.5,
    color: '#6a6a6a', marginTop: 10,
  },

  topRow: {
    position: 'absolute', top: 190, left: MARGIN_X, right: MARGIN_X,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  emisorBlock: { width: 240 },
  clienteBlock: { width: 240, alignItems: 'flex-end' },
  emisorNombre: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, marginBottom: 3, letterSpacing: 0.4 },
  emisorLine: { fontSize: 9.5, marginBottom: 1.5, color: '#4a4a4a' },
  clienteHeader: {
    fontSize: 8.5, marginBottom: 4, letterSpacing: 2.5, color: '#9a9a9a',
  },
  clienteLine: { fontSize: 9.5, marginBottom: 1.5, textAlign: 'right', color: '#2a2a2a' },
  clienteWarning: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, color: '#b91c1c', textAlign: 'right' },

  fechaLine: {
    position: 'absolute', top: 305, left: MARGIN_X,
    fontSize: 9.5, color: '#6a6a6a', letterSpacing: 0.5,
  },

  tableHeaderTopLine: {
    position: 'absolute', top: 340, left: MARGIN_X, right: MARGIN_X, height: 0.6,
  },
  tableHeader: {
    position: 'absolute', top: 350, left: MARGIN_X, right: MARGIN_X,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  thDesc: { fontSize: 8, letterSpacing: 2, color: '#9a9a9a' },
  thImp: { fontSize: 8, letterSpacing: 2, color: '#9a9a9a', textAlign: 'right' },

  // Wrapper absoluto entre cabecera y pie. Body crece (flexGrow) y bottomBlock
  // se ancla al pie del wrapper con marginTop:auto — evita solapamiento y
  // paginas vacias.
  body: {},
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  lineTitulo: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', marginBottom: 2, color: '#2a2a2a' },
  lineDesc: { fontSize: 9.5, lineHeight: 1.5, color: '#5a5a5a' },
  lineConcepto: { flex: 1, fontSize: 10, paddingRight: 16, color: '#2a2a2a' },
  lineImp: { width: 90, textAlign: 'right', fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#2a2a2a' },

  bottomBlock: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 24,
  },
  totalsBox: { width: PAGE_W / 2 - MARGIN_X },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 9.5, color: '#6a6a6a', letterSpacing: 0.5 },
  totalValue: { fontSize: 9.5, textAlign: 'right', color: '#2a2a2a' },
  totalDivider: { height: 1, marginVertical: 5 },
  totalLabelBig: { fontSize: 12, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, color: '#1a1a1a' },
  totalValueBig: { fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'right', color: '#1a1a1a' },

  pieObligatorio: {
    position: 'absolute', bottom: 80, left: MARGIN_X, right: MARGIN_X,
    fontSize: 7.5, color: '#3a3a3a', textAlign: 'center',
    fontFamily: 'Helvetica-Bold', lineHeight: 1.4,
  },
  legalText: {
    position: 'absolute', bottom: 55, left: MARGIN_X, right: MARGIN_X,
    fontSize: 6.5, color: '#7a7a7a', textAlign: 'center', lineHeight: 1.45,
  },
  footerContact: {
    position: 'absolute', bottom: 30, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', fontSize: 9,
  },
  contactItem: { marginHorizontal: 22, letterSpacing: 0.4 },
  pageNumber: {
    position: 'absolute', bottom: 18, right: MARGIN_X,
    fontSize: 8, color: '#9a9a9a',
  },
});

function Minimal({ tipo, doc, lineas, cliente, settings }) {
  const v = deriveDocData({ tipo, doc, lineas, cliente, settings });
  const lineGap = tipo === 'presupuesto' ? LINE_GAP_PRES : LINE_GAP_FAC;
  const breaks = computeLineBreaks(v.ls, v.d.modo_detallado, v.d.factura_ocultar_subitems);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.topLine, { backgroundColor: v.brandColor }]} fixed />

        {v.logoUrl ? <Image src={v.logoUrl} style={styles.logo} fixed /> : null}

        <View style={styles.titleBlock} fixed>
          <Text
            style={[
              styles.title,
              tipo === 'factura' && v.marcarBorrador ? { fontSize: 22, letterSpacing: 1.5 } : null,
              v.tituloLargo ? { fontSize: 18, letterSpacing: 1.5 } : null,
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
            <View key={`row-${i}`} style={{ marginBottom: lineGap }} wrap={false} break={breaks.has(i)}>
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

        <View style={[styles.footerContact, { color: v.brandColor }]} fixed>
          {v.s.emisor_telefono ? (
            <Text style={[styles.contactItem, { color: v.brandColor }]}>
              {`Tel: ${v.s.emisor_telefono}`}
            </Text>
          ) : null}
          {v.s.emisor_email ? (
            <Text style={[styles.contactItem, { color: v.brandColor }]}>
              {`Email: ${v.s.emisor_email}`}
            </Text>
          ) : null}
        </View>

        <View style={[styles.bottomLine, { backgroundColor: v.brandColor }]} fixed />

        <PageNumberFooter style={styles.pageNumber} />

        {tipo === 'factura' && v.marcarBorrador ? <Watermark /> : null}
      </Page>
    </Document>
  );
}

export default Minimal;
