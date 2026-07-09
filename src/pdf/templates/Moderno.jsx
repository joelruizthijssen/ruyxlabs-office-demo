// Plantilla "Moderno" — sidebar oscura (slate-800) en el lateral izquierdo
// con titulo, numero, emisor, contacto y firma. Contenido principal a la
// derecha. Look corporativo SaaS. El brand_color se usa como acento puntual.
//
// v1.1.1: vuelve al diseño con sidebar (en lugar del layout sin sidebar que
// habíamos probado en v1.16 y que al usuario no le convencía). Ajustes
// frente a la version original:
//  - Sidebar 165pt (antes 150) para que "PRESUPUESTO" quepa bien en una línea.
//  - Body en flow normal con paddingTop/Bottom — no más position:absolute
//    para body/bottomBlock, así no se solapan líneas con totales.
//  - Logo más pequeño en la sidebar (75x45) para que no aplaste el resto.

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

const SIDEBAR_W = 165;
const ML = SIDEBAR_W + 30;
const MR = 40;
const SIDEBAR_BG = '#1f2937';
const SIDEBAR_FG = '#f1f5f9';
const SIDEBAR_MUTED = '#94a3b8';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica', fontSize: 10, color: '#3a3a3a',
    // Padding: top deja sitio a fechaBlock + clienteBlock + tableHeader
    // absolutos. Bottom deja sitio a footer/legal/pie.
    paddingTop: 235, paddingBottom: 110,
    paddingLeft: ML, paddingRight: MR,
  },

  // Sidebar oscura anclada arriba/abajo (sin height fijo).
  sidebar: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: SIDEBAR_W,
    backgroundColor: SIDEBAR_BG,
    paddingHorizontal: 16, paddingVertical: 45,
    color: SIDEBAR_FG,
  },
  sbLogo: {
    width: 75, height: 45, objectFit: 'contain', marginBottom: 22,
  },
  sbTitle: {
    fontSize: 16, fontFamily: 'Helvetica-Bold',
    color: '#ffffff', letterSpacing: 1.5, marginBottom: 4,
  },
  sbAccent: {
    height: 2, width: 28, marginBottom: 14,
  },
  sbNumero: {
    fontSize: 9, color: SIDEBAR_MUTED, marginBottom: 18,
    letterSpacing: 0.5,
  },
  sbSection: {
    fontSize: 7.5, color: SIDEBAR_MUTED, letterSpacing: 1.5,
    textTransform: 'uppercase', marginBottom: 4, marginTop: 14,
  },
  sbEmisorNombre: {
    fontSize: 10, fontFamily: 'Helvetica-Bold',
    color: '#ffffff', marginBottom: 3,
  },
  sbEmisorLine: {
    fontSize: 9, color: SIDEBAR_FG, marginBottom: 2, lineHeight: 1.3,
  },
  sbContact: {
    fontSize: 8.5, color: SIDEBAR_MUTED, marginBottom: 2,
  },
  sbFirma: {
    width: 100, height: 40, marginTop: 10, objectFit: 'contain',
  },

  // Cabecera del contenido principal (absolutos).
  fechaBlock: {
    position: 'absolute', top: 50, left: ML, right: MR,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  fechaLine: { fontSize: 9.5, color: '#5a5a5a', letterSpacing: 0.5 },

  clienteBlock: {
    position: 'absolute', top: 90, left: ML, right: MR,
  },
  clienteHeader: {
    fontSize: 8, color: '#9a9a9a', letterSpacing: 1.5, marginBottom: 4,
    textTransform: 'uppercase',
  },
  clienteLine: { fontSize: 10, marginBottom: 1.5, color: '#2a2a2a' },
  clienteWarning: {
    fontFamily: 'Helvetica-Bold', fontSize: 11, color: '#b91c1c',
  },

  tableHeaderTopLine: {
    position: 'absolute', top: 195, left: ML, right: MR, height: 1.5,
  },
  tableHeader: {
    position: 'absolute', top: 205, left: ML, right: MR,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  thDesc: {
    fontFamily: 'Helvetica-Bold', fontSize: 9.5,
    letterSpacing: 1.5, color: '#3a3a3a', textTransform: 'uppercase',
  },
  thImp: {
    fontFamily: 'Helvetica-Bold', fontSize: 9.5,
    letterSpacing: 1.5, color: '#3a3a3a', textAlign: 'right',
    textTransform: 'uppercase',
  },

  // Body y bottomBlock en flow normal — paginas adicionales si hace falta.
  body: {},
  lineRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  lineTitulo: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  lineDesc: { fontSize: 9.5, lineHeight: 1.4, color: '#5a5a5a' },
  lineConcepto: { flex: 1, fontSize: 10, paddingRight: 16, color: '#2a2a2a' },
  lineImp: {
    width: 90, textAlign: 'right', fontSize: 10.5,
    fontFamily: 'Helvetica-Bold', color: '#1a1a1a',
  },

  bottomBlock: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginTop: 24,
  },
  totalsBox: { width: 220 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 10, color: '#5a5a5a' },
  totalValue: { fontSize: 10, textAlign: 'right', color: '#2a2a2a' },
  totalDivider: { height: 1, marginVertical: 5 },
  totalLabelBig: {
    fontSize: 12, fontFamily: 'Helvetica-Bold',
    letterSpacing: 1, color: '#1a1a1a',
  },
  totalValueBig: {
    fontSize: 12, fontFamily: 'Helvetica-Bold',
    textAlign: 'right', color: '#1a1a1a',
  },

  pieObligatorio: {
    position: 'absolute', bottom: 80, left: ML, right: MR,
    fontSize: 7.5, color: '#3a3a3a', textAlign: 'center',
    fontFamily: 'Helvetica-Bold', lineHeight: 1.4,
  },
  legalText: {
    position: 'absolute', bottom: 50, left: ML, right: MR,
    fontSize: 6.5, color: '#7a7a7a', textAlign: 'center', lineHeight: 1.4,
  },
  pageNumber: {
    position: 'absolute', bottom: 18, right: MR,
    fontSize: 8, color: '#9a9a9a',
  },
});

function Moderno({ tipo, doc, lineas, cliente, settings }) {
  const v = deriveDocData({ tipo, doc, lineas, cliente, settings });
  const lineGap = tipo === 'presupuesto' ? LINE_GAP_PRES : LINE_GAP_FAC;
  const breaks = computeLineBreaks(v.ls, v.d.modo_detallado, v.d.factura_ocultar_subitems);
  const ocultarEmisor = !!v.s.ocultar_emisor;
  // v1.2.31: documento interno — oculta TODO el bloque emisor del sidebar
  // de Moderno (nombre, NIF, direccion, contacto, firma). Coherente con
  // EmisorBlock que tambien devuelve null en este caso.
  const docInterno = !!v.s._docInterno;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* SIDEBAR oscura — fixed: se repite en cada pagina */}
        <View style={styles.sidebar} fixed>
          {v.logoUrl ? <Image src={v.logoUrl} style={styles.sbLogo} /> : null}

          <Text
            style={[
              styles.sbTitle,
              tipo === 'factura' && v.marcarBorrador ? { fontSize: 12, letterSpacing: 0.5 } : null,
              v.tituloLargo ? { fontSize: 12, letterSpacing: 0.5 } : null,
            ]}
          >
            {v.tituloDoc}
          </Text>
          <View style={[styles.sbAccent, { backgroundColor: v.brandColor }]} />
          <Text style={styles.sbNumero}>{v.cabeceraNumero}</Text>

          {!docInterno ? (
            <>
              <Text style={styles.sbSection}>Emisor</Text>
              {v.s._marcaNombre ? (
                <Text style={styles.sbEmisorNombre}>{v.s._marcaNombre}</Text>
              ) : (!ocultarEmisor && v.s.emisor_nombre ? (
                <Text style={styles.sbEmisorNombre}>{v.s.emisor_nombre}</Text>
              ) : null)}
              {v.s._marcaNombre && !ocultarEmisor && v.s.emisor_nombre ? (
                <Text style={[styles.sbEmisorLine, { fontSize: 7.5, opacity: 0.7 }]}>
                  {v.s.emisor_nombre}
                </Text>
              ) : null}
              {v.s.emisor_nif ? (
                <Text style={styles.sbEmisorLine}>{v.s.emisor_nif}</Text>
              ) : null}
              {v.dirLine1 ? <Text style={styles.sbEmisorLine}>{v.dirLine1}</Text> : null}
              {v.dirLine2 ? <Text style={styles.sbEmisorLine}>{v.dirLine2}</Text> : null}

              {(v.s.emisor_telefono || v.s.emisor_email) && (
                <>
                  <Text style={styles.sbSection}>Contacto</Text>
                  {v.s.emisor_telefono ? (
                    <Text style={styles.sbContact}>Tel: {v.s.emisor_telefono}</Text>
                  ) : null}
                  {v.s.emisor_email ? (
                    <Text style={styles.sbContact}>{v.s.emisor_email}</Text>
                  ) : null}
                </>
              )}

              {v.firmaUrl ? <Image src={v.firmaUrl} style={styles.sbFirma} /> : null}
            </>
          ) : null}
        </View>

        {/* CONTENIDO principal — cabecera fixed para que se repita en cada pag */}
        <View style={styles.fechaBlock} fixed>
          <Text style={styles.fechaLine}>{v.fechaTxt}</Text>
        </View>

        <View style={styles.clienteBlock} fixed>
          <Text style={styles.clienteHeader}>Cliente</Text>
          <ClienteContent
            tipo={tipo}
            cliente={cliente}
            cpCiudad={v.cpCiudad}
            asuntoFallback={v.d.asunto}
            styles={styles}
          />
        </View>

        <View style={[styles.tableHeaderTopLine, { backgroundColor: v.brandColor }]} fixed />
        <View style={styles.tableHeader} fixed>
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

          <View style={styles.bottomBlock}>
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
        <BravaFooter />

        <PageNumberFooter style={styles.pageNumber} />

        {tipo === 'factura' && v.marcarBorrador ? <Watermark /> : null}
      </Page>
    </Document>
  );
}

export default Moderno;
