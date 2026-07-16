// Plantilla "Personalizada" — usa una imagen de membrete que el usuario sube
// en Ajustes como FONDO completo del A4. El contenido del documento (título,
// emisor opcional, cliente, líneas, totales, QR, firma, calendario de pagos
// para presupuestos) se dibuja encima dentro de los márgenes "seguros"
// configurados por el usuario. Si el membrete ya incluye datos del emisor o
// logo, los toggles correspondientes los suprimen para evitar duplicados.
//
// IMPORTANTE — orden de pintado en @react-pdf/renderer 4.x:
// En esta version, `Image` con `position: absolute` y dimensiones page-size
// se pinta SIEMPRE encima de cualquier `View absolute`, ignorando zIndex y
// el orden del JSX. Por eso esta plantilla, a diferencia de Bandas/Minimal/
// etc., usa FLOW NORMAL para todo el contenido y solo el membrete va
// absolute. Como el contenido en flow se pinta despues del background, los
// datos quedan correctamente por encima del membrete.

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

const DEFAULT_LAYOUT = {
  margen_top: 130,
  margen_bottom: 100,
  margen_left: 50,
  margen_right: 50,
  incluye_emisor: false,
  // Logo activado por defecto: si el usuario tiene logo subido en Ajustes,
  // aparece en el PDF sin tener que configurar nada del membrete_layout.
  incluye_logo: true,
  color_texto: '#1a1a1a',
};

function Personalizada({ tipo, doc, lineas, cliente, settings }) {
  const v = deriveDocData({ tipo, doc, lineas, cliente, settings });
  const cfg = { ...DEFAULT_LAYOUT, ...(v.s.membrete_layout_parsed || {}) };
  const membreteUrl = v.s.membrete_data_url || null;
  const lineGap = tipo === 'presupuesto' ? LINE_GAP_PRES : LINE_GAP_FAC;
  const breaks = computeLineBreaks(v.ls, v.d.modo_detallado, v.d.factura_ocultar_subitems);

  const txtColor = cfg.color_texto || '#1a1a1a';
  const muted = '#6a6a6a';

  const styles = StyleSheet.create({
    page: { fontFamily: 'Helvetica', fontSize: 10, color: txtColor },

    // Capa de fondo: el membrete. Position absolute para que el contenido
    // en flow se pinte ENCIMA. No usamos `fixed` porque eso lo movería a
    // la capa superior (overlay) en @react-pdf 4.x.
    backgroundLayer: {
      position: 'absolute',
      top: 0, left: 0,
      width: PAGE_W, height: PAGE_H,
    },

    // Wrapper del contenido en flow normal. SIN flexGrow para permitir que
    // @react-pdf haga salto natural a una página 2 si el contenido excede
    // la altura disponible (en lugar de comprimir el espaciado).
    content: {
      paddingTop: cfg.margen_top,
      paddingLeft: cfg.margen_left,
      paddingRight: cfg.margen_right,
      paddingBottom: cfg.margen_bottom,
    },

    titleBlock: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 20,
    },
    title: {
      fontSize: 26, fontFamily: 'Helvetica-Bold',
      letterSpacing: 2.5, color: txtColor,
    },
    numero: {
      fontSize: 11, fontFamily: 'Helvetica-Bold',
      color: txtColor, letterSpacing: 1,
    },

    logoRow: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      marginBottom: 8,
    },
    logo: { width: 90, height: 45, objectFit: 'contain' },

    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    emisorBlock: { width: 220 },
    clienteBlock: { width: 220, alignItems: 'flex-end' },
    emisorNombre: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, marginBottom: 2, color: txtColor },
    emisorLine: { fontSize: 9.5, marginBottom: 1, color: muted },
    clienteHeader: {
      fontSize: 8, color: muted, letterSpacing: 1.5,
      marginBottom: 4, textTransform: 'uppercase',
    },
    clienteLine: { fontSize: 9.5, marginBottom: 1, textAlign: 'right', color: txtColor },
    clienteWarning: {
      fontFamily: 'Helvetica-Bold', fontSize: 11,
      color: '#b91c1c', textAlign: 'right',
    },

    fechaLine: {
      fontSize: 9.5, color: muted, letterSpacing: 0.5,
      marginBottom: 10,
    },

    tableHeaderTopLine: {
      height: 1,
      marginBottom: 8,
    },
    tableHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    thDesc: {
      fontFamily: 'Helvetica-Bold', fontSize: 9.5,
      letterSpacing: 1.2, color: txtColor, textTransform: 'uppercase',
    },
    thImp: {
      fontFamily: 'Helvetica-Bold', fontSize: 9.5,
      letterSpacing: 1.2, color: txtColor, textAlign: 'right',
      textTransform: 'uppercase',
    },

    body: {},
    lineRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    lineTitulo: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', marginBottom: 2, color: txtColor },
    lineDesc: { fontSize: 9.5, lineHeight: 1.4, color: muted },
    lineConcepto: { flex: 1, fontSize: 10, paddingRight: 16, color: txtColor },
    lineImp: {
      width: 90, textAlign: 'right', fontSize: 10.5,
      fontFamily: 'Helvetica-Bold', color: txtColor,
    },

    bottomBlock: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginTop: 24,
    },
    totalsBox: { width: 220 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    totalLabel: { fontSize: 10, color: muted },
    totalValue: { fontSize: 10, textAlign: 'right', color: txtColor },
    totalDivider: { height: 0.7, marginVertical: 5 },
    totalLabelBig: {
      fontSize: 12, fontFamily: 'Helvetica-Bold',
      letterSpacing: 1, color: txtColor,
    },
    totalValueBig: {
      fontSize: 12, fontFamily: 'Helvetica-Bold',
      textAlign: 'right', color: txtColor,
    },

    // El pie obligatorio y el legal SÍ van absolute (anclados al bottom de
    // la pagina, independientes del flow). Como vienen DESPUES en el JSX,
    // se pintan sobre el contenido y el background — perfecto.
    pieObligatorio: {
      position: 'absolute',
      bottom: cfg.margen_bottom - 15,
      left: cfg.margen_left, right: cfg.margen_right,
      fontSize: 7.5, color: txtColor, textAlign: 'center',
      fontFamily: 'Helvetica-Bold', lineHeight: 1.4,
    },
    legalText: {
      position: 'absolute',
      bottom: Math.max(30, cfg.margen_bottom - 40),
      left: cfg.margen_left, right: cfg.margen_right,
      fontSize: 6.5, color: muted, textAlign: 'center', lineHeight: 1.4,
    },
    pageNumber: {
      position: 'absolute',
      bottom: Math.max(10, cfg.margen_bottom - 70),
      right: cfg.margen_right,
      fontSize: 8, color: muted,
    },
  });

  const haveMembrete = !!membreteUrl;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* CAPA 1: background (membrete o placeholder). fixed = se repite
            en TODAS las páginas al hacer salto natural. */}
        {haveMembrete ? (
          <View style={styles.backgroundLayer} fixed>
            <Image
              src={membreteUrl}
              style={{ width: PAGE_W, height: PAGE_H }}
            />
          </View>
        ) : (
          <View
            style={{
              ...styles.backgroundLayer,
              backgroundColor: '#fafafa',
              alignItems: 'center', justifyContent: 'center',
            }}
            fixed
          >
            <Text style={{ fontSize: 11, color: '#9a9a9a', textAlign: 'center', maxWidth: 300 }}>
              Sube tu membrete en Ajustes → Diseño → Membrete personalizado
            </Text>
          </View>
        )}

        {/* CAPA 2: contenido en FLOW NORMAL — se pinta sobre el background */}
        <View style={styles.content}>
          {cfg.incluye_logo && v.logoUrl ? (
            <View style={styles.logoRow}>
              <Image src={v.logoUrl} style={styles.logo} />
            </View>
          ) : null}

          <View style={styles.titleBlock}>
            <Text
              style={[
                styles.title,
                tipo === 'factura' && v.marcarBorrador ? { fontSize: 20, letterSpacing: 1 } : null,
                v.tituloLargo ? { fontSize: 14, letterSpacing: 1 } : null,
              ]}
            >
              {v.tituloDoc}
            </Text>
            <Text style={styles.numero}>{v.cabeceraNumero}</Text>
          </View>

          <View style={styles.topRow}>
            {cfg.incluye_emisor ? (
              <View style={styles.emisorBlock}>
                <EmisorBlock
                  s={v.s}
                  dirLine1={v.dirLine1}
                  dirLine2={v.dirLine2}
                  styles={styles}
                  firmaUrl={v.firmaUrl}
                />
              </View>
            ) : (
              <View style={styles.emisorBlock}>
                {v.firmaUrl ? (
                  <Image
                    src={v.firmaUrl}
                    style={{ width: 100, height: 40, objectFit: 'contain' }}
                  />
                ) : null}
              </View>
            )}
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

          <Text style={styles.fechaLine}>{v.fechaTxt}</Text>

          <View style={[styles.tableHeaderTopLine, { backgroundColor: v.brandColor }]} />
          <View style={styles.tableHeader}>
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
          </View>

          <View style={styles.bottomBlock} wrap={false}>
            <SepaQrBlock qrDataUrl={v.qrDataUrl} />
            <View style={styles.totalsBox}>
              <TotalsBlock {...v} styles={styles} dividerColor={v.brandColor} />
            </View>
          </View>
        </View>

        {/* CAPA 3: pie/legal/footer anclados al bottom — fixed = en todas las páginas */}
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

export default Personalizada;
