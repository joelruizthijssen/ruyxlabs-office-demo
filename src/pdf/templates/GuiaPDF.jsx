// PDF de la guia de usuario. A diferencia de los PDF de facturas (que tienen
// layouts absolutos y plantillas), este es un documento de texto fluido
// estandar: paginacion natural de @react-pdf, encabezado en cada pagina,
// numero de pagina al pie. Toma como entrada un array de secciones tal y
// como las exporta src/data/guiaContenido.js.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const COLOR_BRAND = '#1abc9c';
const COLOR_TEXT = '#1f2933';
const COLOR_MUTED = '#6b7280';
const COLOR_AVISO_BG = '#fef3c7';
const COLOR_AVISO_BORDE = '#f59e0b';
const COLOR_TIP_BG = '#dcfce7';
const COLOR_TIP_BORDE = '#22c55e';

const styles = StyleSheet.create({
  page: {
    paddingTop: 70,
    paddingBottom: 50,
    paddingHorizontal: 50,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: COLOR_TEXT,
    lineHeight: 1.5,
  },
  header: {
    position: 'absolute',
    top: 30,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    fontSize: 8,
    color: COLOR_MUTED,
  },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: COLOR_MUTED,
  },
  portadaTitulo: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: COLOR_TEXT,
    marginBottom: 6,
  },
  portadaSubtitulo: {
    fontSize: 14,
    color: COLOR_MUTED,
    marginBottom: 30,
  },
  portadaMeta: {
    fontSize: 10,
    color: COLOR_MUTED,
    marginBottom: 4,
  },
  indiceTitulo: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: COLOR_TEXT,
    marginTop: 30,
    marginBottom: 12,
  },
  indiceItem: {
    fontSize: 10,
    color: COLOR_TEXT,
    marginBottom: 4,
  },
  seccionTitulo: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: COLOR_BRAND,
    marginBottom: 10,
    marginTop: 4,
  },
  subtitulo: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: COLOR_TEXT,
    marginTop: 12,
    marginBottom: 6,
  },
  parrafo: {
    fontSize: 10,
    color: COLOR_TEXT,
    marginBottom: 8,
    textAlign: 'justify',
  },
  listaItem: {
    fontSize: 10,
    color: COLOR_TEXT,
    marginBottom: 4,
    paddingLeft: 12,
  },
  aviso: {
    backgroundColor: COLOR_AVISO_BG,
    borderLeftWidth: 3,
    borderLeftColor: COLOR_AVISO_BORDE,
    padding: 8,
    marginVertical: 8,
    fontSize: 9.5,
  },
  tip: {
    backgroundColor: COLOR_TIP_BG,
    borderLeftWidth: 3,
    borderLeftColor: COLOR_TIP_BORDE,
    padding: 8,
    marginVertical: 8,
    fontSize: 9.5,
  },
});

function Bloque({ b }) {
  if (b.tipo === 'parrafo') return <Text style={styles.parrafo}>{b.texto}</Text>;
  if (b.tipo === 'subtitulo') return <Text style={styles.subtitulo}>{b.texto}</Text>;
  if (b.tipo === 'lista') {
    return (
      <View>
        {b.items.map((it, i) => (
          <Text key={i} style={styles.listaItem}>{`•  ${it}`}</Text>
        ))}
      </View>
    );
  }
  if (b.tipo === 'aviso') {
    return (
      <View style={styles.aviso}>
        <Text>{b.texto}</Text>
      </View>
    );
  }
  if (b.tipo === 'tip') {
    return (
      <View style={styles.tip}>
        <Text>{b.texto}</Text>
      </View>
    );
  }
  return null;
}

export function GuiaPDF({ secciones, appVersion, appName, fechaGeneracion }) {
  const titulo = appName || 'Ruyx Office';
  const meta = `${titulo} · Guía de uso`;
  return (
    <Document title={`Guia ${titulo} v${appVersion}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Text>{meta}</Text>
          <Text>v{appVersion}</Text>
        </View>

        <Text style={styles.portadaTitulo}>{titulo}</Text>
        <Text style={styles.portadaSubtitulo}>Guía de uso</Text>
        <Text style={styles.portadaMeta}>{`Versión ${appVersion}`}</Text>
        <Text style={styles.portadaMeta}>{`Generada el ${fechaGeneracion}`}</Text>

        <Text style={styles.indiceTitulo}>Índice</Text>
        {secciones.map((s, i) => (
          <Text key={s.id} style={styles.indiceItem}>{`${i + 1}.  ${s.titulo}`}</Text>
        ))}

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${meta}   ·   Página ${pageNumber} de ${totalPages}`
          }
        />

        {secciones.map((s, i) => (
          <View key={s.id} break={i === 0}>
            <Text style={styles.seccionTitulo}>{`${i + 1}.  ${s.titulo}`}</Text>
            {s.bloques.map((b, bi) => (
              <Bloque key={bi} b={b} />
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
