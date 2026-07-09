// Plantilla "Constructora" — look robusto para construcción / gremios /
// reformas. Banda sólida de color arriba con título y número, franja de
// "OBRA / PROYECTO" destacando el asunto del documento, tabla con bordes
// marcados y caja de totales enmarcada. Tipografía fuerte, sin florituras.
// Cabecera fija que se repite en cada página + "Página X de Y".

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import {
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

const HEADER_H = 95;

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica', fontSize: 10, color: '#33373a',
    // Cabecera absolute acaba ~HEADER_H + 200; pie fijo ~160.
    paddingTop: HEADER_H + 205, paddingBottom: 125, paddingHorizontal: MARGIN_X,
  },

  // Banda sólida superior con título + número.
  headerBlock: {
    position: 'absolute', top: 0, left: 0, right: 0, height: HEADER_H,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: MARGIN_X,
  },
  // v1.2.38: title 28 -> 18 (madre pidio "logo > FACTURA").
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', letterSpacing: 2, color: '#ffffff' },
  numero: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#ffffff', opacity: 0.92, letterSpacing: 1 },

  // Logo debajo de la banda (sobre fondo blanco — evita logos oscuros sobre
  // banda de color).
  logo: {
    position: 'absolute', top: HEADER_H + 14, left: MARGIN_X,
    width: 110, height: 50, objectFit: 'contain',
  },

  // Franja "OBRA / PROYECTO" — destaca el asunto del documento. Si no hay
  // asunto, igual mostramos la etiqueta vacía para mantener la rejilla.
  obraStrip: {
    position: 'absolute', top: HEADER_H + 14, left: MARGIN_X + 130, right: MARGIN_X,
    borderWidth: 1, borderColor: '#d4d4d4', borderRadius: 3,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  obraLabel: { fontSize: 7.5, color: '#9a9a9a', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  obraValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#2a2a2a' },

  topRow: {
    position: 'absolute', top: HEADER_H + 88, left: MARGIN_X, right: MARGIN_X,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  emisorBlock: { width: 240 },
  clienteBlock: { width: 240, alignItems: 'flex-end' },
  emisorNombre: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, marginBottom: 2, color: '#2a2a2a' },
  emisorLine: { fontSize: 9.5, marginBottom: 1, color: '#5a5a5a' },
  clienteHeader: {
    fontSize: 8, color: '#9a9a9a', letterSpacing: 1.5,
    marginBottom: 3, textTransform: 'uppercase',
  },
  clienteLine: { fontSize: 9.5, marginBottom: 1, textAlign: 'right', color: '#2a2a2a' },
  clienteWarning: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: '#b91c1c', textAlign: 'right' },

  fechaLine: {
    position: 'absolute', top: HEADER_H + 168, left: MARGIN_X,
    fontSize: 9.5, color: '#6a6a6a',
  },
  tableHeader: {
    position: 'absolute', top: HEADER_H + 188, left: MARGIN_X, right: MARGIN_X,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, paddingHorizontal: 8,
  },
  thDesc: { fontFamily: 'Helvetica-Bold', fontSize: 9, letterSpacing: 0.8, color: '#ffffff', textTransform: 'uppercase' },
  thImp: { fontFamily: 'Helvetica-Bold', fontSize: 9, letterSpacing: 0.8, color: '#ffffff', textAlign: 'right', textTransform: 'uppercase' },

  body: {},
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  lineTitulo: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', marginBottom: 2, color: '#2a2a2a' },
  lineDesc: { fontSize: 9.5, lineHeight: 1.4, color: '#5a5a5a' },
  lineConcepto: { flex: 1, fontSize: 10, paddingRight: 16, color: '#2a2a2a' },
  lineImp: { width: 90, textAlign: 'right', fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#1a1a1a' },

  bottomBlock: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginTop: 24,
  },
  // Caja de totales enmarcada — refuerza el look "presupuesto de obra".
  totalsBox: {
    width: 240,
    borderWidth: 1, borderColor: '#d4d4d4', borderRadius: 3,
    padding: 12,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 10, color: '#6a6a6a' },
  totalValue: { fontSize: 10, textAlign: 'right', color: '#2a2a2a' },
  totalDivider: { height: 1, marginVertical: 5 },
  totalLabelBig: { fontSize: 13, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8, color: '#1a1a1a' },
  totalValueBig: { fontSize: 13, fontFamily: 'Helvetica-Bold', textAlign: 'right', color: '#1a1a1a' },

  bottomLine: { position: 'absolute', bottom: 96, left: MARGIN_X, right: MARGIN_X, height: 3 },
  pieObligatorio: {
    position: 'absolute', bottom: 74, left: MARGIN_X, right: MARGIN_X,
    fontSize: 7.5, color: '#3a3a3a', textAlign: 'center',
    fontFamily: 'Helvetica-Bold', lineHeight: 1.4,
  },
  legalText: {
    position: 'absolute', bottom: 50, left: MARGIN_X, right: MARGIN_X,
    fontSize: 6.5, color: '#7a7a7a', textAlign: 'center', lineHeight: 1.4,
  },
  footerContact: {
    position: 'absolute', bottom: 30, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', fontSize: 9,
  },
  contactItem: { marginHorizontal: 20 },
  pageNumber: {
    position: 'absolute', bottom: 14, right: MARGIN_X,
    fontSize: 8, color: '#9a9a9a',
  },
});

function Constructora({ tipo, doc, lineas, cliente, settings }) {
  const v = deriveDocData({ tipo, doc, lineas, cliente, settings });
  const lineGap = tipo === 'presupuesto' ? LINE_GAP_PRES : LINE_GAP_FAC;
  const breaks = computeLineBreaks(v.ls, v.d.modo_detallado, v.d.factura_ocultar_subitems);
  const obra = (v.d.asunto || '').trim();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.headerBlock, { backgroundColor: v.brandColor }]} fixed>
          <Text
            style={[
              styles.title,
              tipo === 'factura' && v.marcarBorrador ? { fontSize: 20, letterSpacing: 2 } : null,
              v.tituloLargo ? { fontSize: 15, letterSpacing: 1.5 } : null,
            ]}
          >
            {v.tituloDoc}
          </Text>
          <Text style={styles.numero}>{v.cabeceraNumero}</Text>
        </View>

        {v.logoUrl ? <Image src={v.logoUrl} style={styles.logo} fixed /> : null}

        <View style={styles.obraStrip} fixed>
          <Text style={styles.obraLabel}>
            {tipo === 'factura' ? 'Concepto / Obra' : 'Proyecto / Obra'}
          </Text>
          <Text style={styles.obraValue}>{obra || '—'}</Text>
        </View>

        <View style={styles.topRow} fixed>
          <View style={styles.emisorBlock}>
            <EmisorBlock s={v.s} dirLine1={v.dirLine1} dirLine2={v.dirLine2} styles={styles} firmaUrl={v.firmaUrl} />
          </View>
          <View style={styles.clienteBlock}>
            <Text style={styles.clienteHeader}>Cliente</Text>
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
        <View style={[styles.tableHeader, { backgroundColor: v.brandColor }]} fixed>
          {tipo === 'factura' ? (
            <FacturaTableHeaderCells styles={styles} tableHeaderLeft={v.tableHeaderLeft} />
          ) : (
            <>
              <Text style={styles.thDesc}>{v.tableHeaderLeft}</Text>
              <Text style={styles.thImp}>IMPORTE</Text>
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

export default Constructora;
