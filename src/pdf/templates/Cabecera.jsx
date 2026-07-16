// Plantilla "Cabecera" — bloque solido en color principal arriba (110px) con
// el titulo en blanco. Look corporativo moderno. El logo va debajo del bloque
// para evitar problemas de logos oscuros sobre fondo oscuro.

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

// v1.2.37: HEADER_H reducido de 110 a 70 (banda de color del titulo).
// Antes la cabecera era enorme (~405pt) dejando solo 272pt de area de
// contenido en A4, lo que provocaba que facturas con pocas lineas + totales
// extensos (IVA breakdown + dto + cobros + notas) overflownen a una pagina 2
// vacia. Pedido madre: "para 1 pagina no preparar pagina 2". HEADER_H=70
// suma con paddingBottom reducido para dar 347pt de area de contenido.
const HEADER_H = 70;

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica', fontSize: 10, color: '#3a3a3a',
    paddingTop: HEADER_H + 295, paddingBottom: 130, paddingHorizontal: MARGIN_X,
  },

  headerBlock: {
    position: 'absolute', top: 0, left: 0, right: 0, height: HEADER_H,
    alignItems: 'center', justifyContent: 'center',
  },
  // v1.2.38: title 30 -> 20 (madre pidio "logo > FACTURA").
  title: {
    fontSize: 20, fontFamily: 'Helvetica-Bold',
    letterSpacing: 4, color: '#ffffff',
  },
  numero: {
    fontSize: 10, color: '#ffffff',
    letterSpacing: 2, marginTop: 8, opacity: 0.92,
  },

  logo: {
    position: 'absolute', top: HEADER_H + 18, left: MARGIN_X,
    width: 110, height: 55, objectFit: 'contain',
  },

  topRow: {
    position: 'absolute', top: HEADER_H + 95, left: MARGIN_X, right: MARGIN_X,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  emisorBlock: { width: 240 },
  clienteBlock: { width: 240, alignItems: 'flex-end' },
  emisorNombre: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginBottom: 2 },
  emisorLine: { fontSize: 10, marginBottom: 1 },
  clienteHeader: {
    fontFamily: 'Helvetica-Bold', fontSize: 13,
    marginBottom: 4, letterSpacing: 1,
  },
  clienteLine: { fontSize: 10, marginBottom: 1, textAlign: 'right' },
  clienteWarning: {
    fontFamily: 'Helvetica-Bold', fontSize: 11,
    color: '#b91c1c', textAlign: 'right',
  },

  fechaLine: {
    position: 'absolute', top: HEADER_H + 215, left: MARGIN_X,
    fontSize: 10, color: '#2a2a2a',
  },

  tableHeaderTopLine: {
    position: 'absolute', top: HEADER_H + 240, left: MARGIN_X, right: MARGIN_X, height: 1.2,
  },
  tableHeader: {
    position: 'absolute', top: HEADER_H + 252, left: MARGIN_X, right: MARGIN_X,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  thDesc: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, letterSpacing: 1.2 },
  thImp: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, letterSpacing: 1.2, textAlign: 'right' },
  tableHeaderBottomLine: {
    position: 'absolute', top: HEADER_H + 275, left: MARGIN_X, right: MARGIN_X, height: 0.6, backgroundColor: '#bdbdbd',
  },

  body: {},
  lineRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  lineTitulo: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  lineDesc: { fontSize: 8.5, lineHeight: 1.4 },
  lineConcepto: { flex: 1, fontSize: 9, paddingRight: 16 },
  lineImp: { width: 90, textAlign: 'right', fontSize: 9.5, fontFamily: 'Helvetica-Bold' },

  bottomBlock: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 24,
  },
  totalsBox: { width: PAGE_W / 2 - MARGIN_X },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 10 },
  totalValue: { fontSize: 10, textAlign: 'right' },
  totalDivider: { height: 0.7, backgroundColor: '#2a2a2a', marginVertical: 4 },
  totalLabelBig: { fontSize: 12, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  totalValueBig: { fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'right' },

  bottomLine: { position: 'absolute', bottom: 78, left: MARGIN_X, right: MARGIN_X, height: 1.2 },
  pieObligatorio: {
    position: 'absolute', bottom: 60, left: MARGIN_X, right: MARGIN_X,
    fontSize: 7.5, color: '#2a2a2a', textAlign: 'center',
    fontFamily: 'Helvetica-Bold', lineHeight: 1.4,
  },
  legalText: {
    position: 'absolute', bottom: 38, left: MARGIN_X, right: MARGIN_X,
    fontSize: 6.5, color: '#5a5a5a', textAlign: 'center', lineHeight: 1.4,
  },
  footerContact: {
    position: 'absolute', bottom: 18, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', fontSize: 9.5,
  },
  contactItem: { marginHorizontal: 22 },
  pageNumber: {
    position: 'absolute', bottom: 4, right: MARGIN_X,
    fontSize: 8, color: '#9a9a9a',
  },
});

function Cabecera({ tipo, doc, lineas, cliente, settings }) {
  const v = deriveDocData({ tipo, doc, lineas, cliente, settings });
  const lineGap = tipo === 'presupuesto' ? LINE_GAP_PRES : LINE_GAP_FAC;
  const breaks = computeLineBreaks(v.ls, v.d.modo_detallado, v.d.factura_ocultar_subitems);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.headerBlock, { backgroundColor: v.brandColor }]} fixed>
          <Text
            style={[
              styles.title,
              tipo === 'factura' && v.marcarBorrador ? { fontSize: 22, letterSpacing: 3 } : null,
              v.tituloLargo ? { fontSize: 15, letterSpacing: 2 } : null,
            ]}
          >
            {v.tituloDoc}
          </Text>
          <Text style={styles.numero}>{v.cabeceraNumero}</Text>
        </View>

        {v.logoUrl ? <Image src={v.logoUrl} style={styles.logo} fixed /> : null}

        <View style={styles.topRow} fixed>
          <View style={styles.emisorBlock}>
            <EmisorBlock s={v.s} dirLine1={v.dirLine1} dirLine2={v.dirLine2} styles={styles} firmaUrl={v.firmaUrl} />
          </View>
          <View style={styles.clienteBlock}>
            <Text style={styles.clienteHeader}>{v.L.cliente_header}</Text>
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
            <FacturaTableHeaderCells
              styles={styles}
              tableHeaderLeft={v.tableHeaderLeft}
              colorOverride={v.brandColor}
              L={v.L}
            />
          ) : (
            <>
              <Text style={[styles.thDesc, { color: v.brandColor }]}>{v.tableHeaderLeft}</Text>
              <Text style={[styles.thImp, { color: v.brandColor }]}>{v.L.importe}</Text>
            </>
          )}
        </View>
        <View style={styles.tableHeaderBottomLine} fixed />

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
              <TotalsBlock {...v} styles={styles} />
            </View>
          </View>
        </View>

        <View style={[styles.bottomLine, { backgroundColor: v.brandColor }]} fixed />
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

        <PageNumberFooter style={styles.pageNumber} />

        {tipo === 'factura' && v.marcarBorrador ? <Watermark /> : null}
      </Page>
    </Document>
  );
}

export default Cabecera;
