// PDF simple de una sub-lista de Cuenta Diana (ventas cobradas, gastos
// compartidos, pagos a Diana). Pensado para guardar como justificante o
// imprimir el detalle de un card. Tabla generica configurable por columnas.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { formatEUR, formatFechaES } from '../utils/format.js';

const FUCHSIA = '#a21caf';
const SLATE_TXT = '#1f2937';
const SLATE_DIM = '#6b7280';
const SLATE_LINE = '#e5e7eb';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: SLATE_TXT,
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  titulo: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
    color: FUCHSIA,
  },
  subtitulo: { fontSize: 9, color: SLATE_DIM, marginTop: 3 },
  empresaBlock: { textAlign: 'right' },
  empresaNombre: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: SLATE_TXT,
  },
  empresaLine: { fontSize: 8.5, color: SLATE_DIM, marginTop: 1 },
  banda: {
    height: 2,
    backgroundColor: FUCHSIA,
    marginBottom: 12,
    opacity: 0.7,
  },

  tableHead: {
    flexDirection: 'row',
    paddingVertical: 4,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#9ca3af',
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3.5,
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_LINE,
    paddingHorizontal: 4,
  },
  th: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: '#374151',
  },
  td: { fontSize: 9, color: SLATE_TXT },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#9ca3af',
  },
  totalLabel: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  totalValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    color: FUCHSIA,
  },

  footer: {
    position: 'absolute',
    bottom: 18,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: '#9ca3af',
  },
});

// columnas: [{ key, label, width?, align?, format? }]
// align: 'left' (default) | 'right'
// format: 'fecha' | 'eur' | optional, default raw string
function formatCell(val, format) {
  if (val == null || val === '') return '—';
  if (format === 'fecha') return formatFechaES(val);
  if (format === 'eur') return formatEUR(val);
  return String(val);
}

function CuentaDianaListadoPDF({ titulo, periodo, empresa, filas, columnas, total, totalLabel }) {
  const fechaGen = new Date().toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.titulo}>{titulo}</Text>
            {periodo && (
              <Text style={styles.subtitulo}>Periodo: {periodo}</Text>
            )}
            <Text style={styles.subtitulo}>
              Cuenta interna de socio — Vista interna, NO fiscal.
            </Text>
          </View>
          <View style={styles.empresaBlock}>
            {empresa?.nombre && (
              <Text style={styles.empresaNombre}>{empresa.nombre}</Text>
            )}
            {empresa?.nif && (
              <Text style={styles.empresaLine}>NIF: {empresa.nif}</Text>
            )}
          </View>
        </View>
        <View style={styles.banda} />

        {filas.length === 0 ? (
          <Text style={{ fontSize: 10, color: SLATE_DIM, paddingVertical: 12 }}>
            No hay movimientos en este listado.
          </Text>
        ) : (
          <View>
            <View style={styles.tableHead} fixed>
              {columnas.map((c, i) => (
                <Text
                  key={i}
                  style={[
                    styles.th,
                    c.width ? { width: c.width } : { flex: 1 },
                    c.align === 'right' ? { textAlign: 'right' } : null,
                  ]}
                >
                  {c.label}
                </Text>
              ))}
            </View>
            {filas.map((f, idx) => (
              <View key={idx} style={styles.tableRow} wrap={false}>
                {columnas.map((c, i) => (
                  <Text
                    key={i}
                    style={[
                      styles.td,
                      c.width ? { width: c.width } : { flex: 1 },
                      c.align === 'right'
                        ? { textAlign: 'right', fontFamily: 'Helvetica' }
                        : null,
                    ]}
                  >
                    {formatCell(f[c.key], c.format)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {total != null && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{totalLabel || 'Total'}</Text>
            <Text style={styles.totalValue}>{formatEUR(total)}</Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>Cuenta interna de Diana — Vista interna, NO fiscal.</Text>
          <Text>Generado: {fechaGen}</Text>
        </View>
      </Page>
    </Document>
  );
}

export default CuentaDianaListadoPDF;
