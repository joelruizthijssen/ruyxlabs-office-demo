// Plantilla "Bandas" — la clasica con franjas decorativas en color principal
// arriba (80px) y abajo (30px). Cuatro tiras de la misma color con opacidades
// decrecientes para dar profundidad.

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import {
  PAGE_W,
  MARGIN_X,
  TEXTO_LEGAL_DEFAULT,
  PIE_OBLIGATORIO_FACTURA,
  BandTop,
  BandBottom,
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
  // paddingTop deja sitio a la cabecera absolute (que termina en ~360pt).
  // paddingBottom deja sitio al pie fijo (legal + pieObligatorio + footer).
  // El body fluye en este area y, si rebosa, @react-pdf hace salto a pag 2
  // (donde la cabecera no se repite pero el pie sí, por prop `fixed`).
  page: {
    fontFamily: 'Helvetica', fontSize: 10, color: '#3a3a3a',
    paddingTop: 375, paddingBottom: 110, paddingHorizontal: MARGIN_X,
  },
  // Cabecera: logo a la izquierda (esquina sup izq, debajo de BandTop) y
  // titleBlock (titulo + numero) a la derecha. En la misma fila para no
  // solaparse. Mucho aire arriba para que respire.
  logo: { position: 'absolute', top: 100, left: MARGIN_X, width: 100, height: 60, objectFit: 'contain' },
  titleBlock: {
    position: 'absolute', top: 115, left: MARGIN_X + 130, right: MARGIN_X,
    flexDirection: 'column', alignItems: 'flex-end',
  },
  // v1.2.38: title 30 -> 20 (madre pidio "logo > FACTURA"). topRow subido 35pt
  // (210 -> 175) y resto de fixed elements subidos en consecuencia para
  // aprovechar mas el A4. paddingTop ajustado en -35.
  title: { fontSize: 20, color: '#3a3a3a', letterSpacing: 1.5 },
  numero: { fontSize: 11, fontFamily: 'Helvetica-Bold', letterSpacing: 1.2, color: '#3a3a3a', marginTop: 4 },
  topRow: {
    position: 'absolute', top: 175, left: MARGIN_X, right: MARGIN_X,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  emisorBlock: { width: 240 },
  clienteBlock: { width: 240, alignItems: 'flex-end' },
  emisorNombre: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginBottom: 2 },
  emisorLine: { fontSize: 10, marginBottom: 1 },
  clienteHeader: { fontFamily: 'Helvetica-Bold', fontSize: 12, marginBottom: 3, letterSpacing: 1 },
  clienteLine: { fontSize: 10, marginBottom: 1, textAlign: 'right' },
  clienteWarning: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: '#b91c1c', textAlign: 'right' },
  fechaLine: { position: 'absolute', top: 295, left: MARGIN_X, fontSize: 10, color: '#2a2a2a' },
  tableHeaderTopLine: { position: 'absolute', top: 320, left: MARGIN_X, right: MARGIN_X, height: 1.2, backgroundColor: '#2a2a2a' },
  tableHeader: {
    position: 'absolute', top: 332, left: MARGIN_X, right: MARGIN_X,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  thDesc: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, letterSpacing: 1.2, color: '#2a2a2a' },
  thImp: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, letterSpacing: 1.2, color: '#2a2a2a', textAlign: 'right' },
  tableHeaderBottomLine: { position: 'absolute', top: 355, left: MARGIN_X, right: MARGIN_X, height: 0.7, backgroundColor: '#2a2a2a' },
  // Body en flow normal: el paddingTop/Bottom de la Page se encarga de los
  // márgenes. Si excede una página, @react-pdf hace salto natural a pag 2.
  body: {},
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
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
  pieObligatorio: {
    position: 'absolute', bottom: 88, left: MARGIN_X, right: MARGIN_X,
    fontSize: 7.5, color: '#3a3a3a', textAlign: 'center',
    fontFamily: 'Helvetica-Bold', lineHeight: 1.4,
  },
  legalText: {
    position: 'absolute', bottom: 60, left: MARGIN_X, right: MARGIN_X,
    fontSize: 6.5, color: '#5a5a5a', textAlign: 'center', lineHeight: 1.4,
  },
  footerContact: {
    position: 'absolute', bottom: 40, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', fontSize: 10,
  },
  contactItem: { marginHorizontal: 22 },
  pageNumber: {
    position: 'absolute', bottom: 28, right: MARGIN_X,
    fontSize: 8, color: '#9a9a9a',
  },
});

function Bandas({ tipo, doc, lineas, cliente, settings }) {
  const v = deriveDocData({ tipo, doc, lineas, cliente, settings });
  const lineGap = tipo === 'presupuesto' ? LINE_GAP_PRES : LINE_GAP_FAC;
  const breaks = computeLineBreaks(v.ls, v.d.modo_detallado, v.d.factura_ocultar_subitems);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <BandTop color={v.brandColor} fixed />
        {v.logoUrl ? <Image src={v.logoUrl} style={styles.logo} fixed /> : null}

        <View style={styles.titleBlock} fixed>
          <Text
            style={[
              styles.title,
              tipo === 'factura' && v.marcarBorrador
                ? { fontSize: 26, letterSpacing: 1 }
                : null,
              v.tituloLargo ? { fontSize: 16, letterSpacing: 1 } : null,
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

        <View style={styles.tableHeaderTopLine} fixed />
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

        {/* Pies: fixed = aparecen en todas las páginas */}
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

        <BandBottom color={v.brandColor} fixed />

        <PageNumberFooter style={styles.pageNumber} />

        {/* Watermark solo en facturas con el toggle marcar_borrador activo.
            Va al final del JSX para quedar encima del contenido (no hay
            z-index en @react-pdf — manda el orden de aparicion). */}
        {tipo === 'factura' && v.marcarBorrador ? <Watermark /> : null}
      </Page>
    </Document>
  );
}

export default Bandas;
