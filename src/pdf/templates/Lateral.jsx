// Plantilla "Lateral" — banda vertical en el lado izquierdo (75px de ancho)
// con el color principal dividido en 4 segmentos de opacidad decreciente.
// El contenido se desplaza a la derecha. Estilo elegante tipo dossier.

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import {
  PAGE_W,
  PAGE_H,
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

const STRIPE_W = 75;
const ML = 100; // margen izquierdo del contenido
const MR = 55;  // margen derecho

// Banda lateral con 4 segmentos verticales de opacidad decreciente.
// Se renderiza como una sola View con `fixed` para que aparezca en todas las
// páginas. Los segmentos van uno encima del otro cubriendo PAGE_H completo.
function StripeLeft({ color }) {
  const opacities = [1, 0.85, 0.7, 0.55];
  const segH = PAGE_H / opacities.length;
  return (
    <View
      style={{
        position: 'absolute', top: 0, left: 0, bottom: 0,
        width: STRIPE_W,
      }}
      fixed
    >
      {opacities.map((op, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: i * segH,
            left: 0,
            width: STRIPE_W,
            // El ultimo segmento llega hasta `bottom: 0` para evitar gap por
            // redondeo de PAGE_H/4 (la suma exacta puede dejar 1-2pt sin pintar).
            height: i === opacities.length - 1 ? undefined : segH,
            bottom: i === opacities.length - 1 ? 0 : undefined,
            backgroundColor: color || '#1abc9c',
            opacity: op,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica', fontSize: 10, color: '#3a3a3a',
    paddingTop: 360, paddingBottom: 125, paddingLeft: ML, paddingRight: MR,
  },

  // v1.2.38: logo arriba del todo (era top 55), titleBlock mas alto y title
  // 30 -> 20 (madre pidio "logo > FACTURA"). topRow subido para aprovechar
  // el A4 — los elementos absolutos se mueven en bloque ~35pt.
  logo: {
    position: 'absolute', top: 40, left: ML,
    width: 120, height: 60, objectFit: 'contain',
  },

  titleBlock: {
    position: 'absolute', top: 110, left: ML, right: MR,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', letterSpacing: 2, color: '#2a2a2a' },
  numero: { fontSize: 11, fontFamily: 'Helvetica-Bold', letterSpacing: 1.2, color: '#2a2a2a' },

  topRow: {
    position: 'absolute', top: 165, left: ML, right: MR,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  emisorBlock: { width: 220 },
  clienteBlock: { width: 220, alignItems: 'flex-end' },
  emisorNombre: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginBottom: 2 },
  emisorLine: { fontSize: 10, marginBottom: 1 },
  clienteHeader: {
    fontFamily: 'Helvetica-Bold', fontSize: 12,
    marginBottom: 3, letterSpacing: 1,
  },
  clienteLine: { fontSize: 10, marginBottom: 1, textAlign: 'right' },
  clienteWarning: {
    fontFamily: 'Helvetica-Bold', fontSize: 11,
    color: '#b91c1c', textAlign: 'right',
  },

  fechaLine: { position: 'absolute', top: 280, left: ML, fontSize: 10, color: '#2a2a2a' },

  tableHeaderTopLine: { position: 'absolute', top: 305, left: ML, right: MR, height: 1.2 },
  tableHeader: {
    position: 'absolute', top: 317, left: ML, right: MR,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  thDesc: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, letterSpacing: 1.2 },
  thImp: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, letterSpacing: 1.2, textAlign: 'right' },
  tableHeaderBottomLine: { position: 'absolute', top: 340, left: ML, right: MR, height: 0.6, backgroundColor: '#bdbdbd' },

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
  totalsBox: { width: (PAGE_W - ML - MR) / 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 10 },
  totalValue: { fontSize: 10, textAlign: 'right' },
  totalDivider: { height: 0.7, backgroundColor: '#2a2a2a', marginVertical: 4 },
  totalLabelBig: { fontSize: 12, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  totalValueBig: { fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'right' },

  pieObligatorio: {
    position: 'absolute', bottom: 70, left: ML, right: MR,
    fontSize: 7.5, color: '#2a2a2a', textAlign: 'center',
    fontFamily: 'Helvetica-Bold', lineHeight: 1.4,
  },
  legalText: {
    position: 'absolute', bottom: 45, left: ML, right: MR,
    fontSize: 6.5, color: '#5a5a5a', textAlign: 'center', lineHeight: 1.4,
  },
  footerContact: {
    position: 'absolute', bottom: 22, left: STRIPE_W, right: 0,
    flexDirection: 'row', justifyContent: 'center', fontSize: 9.5,
  },
  contactItem: { marginHorizontal: 22 },
  pageNumber: {
    position: 'absolute', bottom: 8, right: MR,
    fontSize: 8, color: '#9a9a9a',
  },
});

function Lateral({ tipo, doc, lineas, cliente, settings }) {
  const v = deriveDocData({ tipo, doc, lineas, cliente, settings });
  const lineGap = tipo === 'presupuesto' ? LINE_GAP_PRES : LINE_GAP_FAC;
  const breaks = computeLineBreaks(v.ls, v.d.modo_detallado, v.d.factura_ocultar_subitems);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <StripeLeft color={v.brandColor} />

        {v.logoUrl ? <Image src={v.logoUrl} style={styles.logo} fixed /> : null}

        <View style={styles.titleBlock} fixed>
          <Text
            style={[
              styles.title,
              tipo === 'factura' && v.marcarBorrador ? { fontSize: 24, letterSpacing: 1.5 } : null,
              v.tituloLargo ? { fontSize: 15, letterSpacing: 1 } : null,
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
            <Text style={styles.clienteHeader}>CLIENT:</Text>
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
            />
          ) : (
            <>
              <Text style={[styles.thDesc, { color: v.brandColor }]}>{v.tableHeaderLeft}</Text>
              <Text style={[styles.thImp, { color: v.brandColor }]}>IMPORTE</Text>
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

export default Lateral;
