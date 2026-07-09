// Plantilla "Apaisado" — A4 horizontal (landscape). Aprovecha el ancho extra
// para conceptos largos y para tener el bloque de totales a la derecha en una
// columna independiente. Útil para presupuestos con descripciones extensas o
// para quien prefiere imprimir/leer en horizontal. Cabecera fija que se
// repite en cada página + "Página X de Y".

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

// A4 landscape: 842 x 595 pt. Márgenes laterales generosos.
const ML = 50;
// El bloque de totales va anclado a la derecha; el cuerpo de líneas ocupa el
// resto del ancho. Reservamos ~240pt para la columna de totales.
const TOTALS_W = 240;

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica', fontSize: 10, color: '#3a3a3a',
    // Header absolute acaba ~155pt; pie fijo ~70pt.
    paddingTop: 165, paddingBottom: 80,
    paddingLeft: ML, paddingRight: ML,
  },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 6 },

  logo: {
    position: 'absolute', top: 26, left: ML,
    width: 110, height: 50, objectFit: 'contain',
  },
  titleBlock: {
    position: 'absolute', top: 28, left: ML, right: ML,
    flexDirection: 'column', alignItems: 'flex-end',
  },
  // v1.2.38: title 26 -> 18 (madre pidio "logo > FACTURA").
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, color: '#2a2a2a' },
  numero: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#5a5a5a', marginTop: 4 },

  topRow: {
    position: 'absolute', top: 88, left: ML, right: ML,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  emisorBlock: { width: 320 },
  clienteBlock: { width: 320, alignItems: 'flex-end' },
  emisorNombre: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 2 },
  emisorLine: { fontSize: 9, marginBottom: 1, color: '#5a5a5a' },
  clienteHeader: {
    fontSize: 8, color: '#9a9a9a', letterSpacing: 1.5,
    marginBottom: 3, textTransform: 'uppercase',
  },
  clienteLine: { fontSize: 9.5, marginBottom: 1, textAlign: 'right', color: '#2a2a2a' },
  clienteWarning: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: '#b91c1c', textAlign: 'right' },

  fechaLine: {
    position: 'absolute', top: 138, left: ML,
    fontSize: 9.5, color: '#6a6a6a',
  },
  tableHeaderTopLine: {
    position: 'absolute', top: 158, left: ML, right: ML, height: 1.2,
  },

  // Layout horizontal: fila con cuerpo (flex) + columna de totales fija.
  contentRow: { flexDirection: 'row', alignItems: 'flex-start' },
  bodyCol: { flex: 1, paddingRight: 30 },
  totalsCol: { width: TOTALS_W },

  tableHeader: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8,
  },
  thDesc: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, letterSpacing: 1, color: '#3a3a3a', textTransform: 'uppercase' },
  thImp: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, letterSpacing: 1, color: '#3a3a3a', textAlign: 'right', textTransform: 'uppercase' },

  body: {},
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  lineTitulo: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2, color: '#2a2a2a' },
  lineDesc: { fontSize: 9, lineHeight: 1.4, color: '#5a5a5a' },
  lineConcepto: { flex: 1, fontSize: 9.5, paddingRight: 16, color: '#2a2a2a' },
  lineImp: { width: 85, textAlign: 'right', fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1a1a1a' },

  // En apaisado, los totales NO van debajo del cuerpo sino en la columna
  // lateral derecha. Esa columna ya está fija; aquí solo definimos la caja.
  totalsBox: {},
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 10, color: '#6a6a6a' },
  totalValue: { fontSize: 10, textAlign: 'right', color: '#2a2a2a' },
  totalDivider: { height: 0.8, marginVertical: 5 },
  totalLabelBig: { fontSize: 12, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8, color: '#1a1a1a' },
  totalValueBig: { fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'right', color: '#1a1a1a' },

  qrWrap: { marginTop: 14, alignItems: 'flex-end' },

  pieObligatorio: {
    position: 'absolute', bottom: 48, left: ML, right: ML,
    fontSize: 7, color: '#3a3a3a', textAlign: 'center',
    fontFamily: 'Helvetica-Bold', lineHeight: 1.35,
  },
  legalText: {
    position: 'absolute', bottom: 30, left: ML, right: ML,
    fontSize: 6, color: '#7a7a7a', textAlign: 'center', lineHeight: 1.35,
  },
  pageNumber: {
    position: 'absolute', bottom: 16, right: ML,
    fontSize: 8, color: '#9a9a9a',
  },
});

function Apaisado({ tipo, doc, lineas, cliente, settings }) {
  const v = deriveDocData({ tipo, doc, lineas, cliente, settings });
  const lineGap = tipo === 'presupuesto' ? LINE_GAP_PRES : LINE_GAP_FAC;
  const breaks = computeLineBreaks(v.ls, v.d.modo_detallado, v.d.factura_ocultar_subitems);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={[styles.topBar, { backgroundColor: v.brandColor }]} fixed />

        {v.logoUrl ? <Image src={v.logoUrl} style={styles.logo} fixed /> : null}

        <View style={styles.titleBlock} fixed>
          <Text
            style={[
              styles.title,
              tipo === 'factura' && v.marcarBorrador ? { fontSize: 18, letterSpacing: 1 } : null,
              v.tituloLargo ? { fontSize: 14, letterSpacing: 1 } : null,
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
        <View style={[styles.tableHeaderTopLine, { backgroundColor: v.brandColor }]} fixed />

        <View style={styles.contentRow}>
          {/* Cuerpo de líneas (columna izquierda, flexible) */}
          <View style={styles.bodyCol}>
            <View style={styles.tableHeader}>
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
            </View>
          </View>

          {/* Columna de totales (derecha, ancho fijo) */}
          <View style={styles.totalsCol}>
            <View style={styles.totalsBox}>
              <TotalsBlock {...v} styles={styles} dividerColor={v.brandColor} />
            </View>
            <View style={styles.qrWrap}>
              <SepaQrBlock qrDataUrl={v.qrDataUrl} />
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

export default Apaisado;
