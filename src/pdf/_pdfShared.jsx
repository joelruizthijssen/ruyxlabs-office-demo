// Componentes y constantes compartidos entre PresupuestoPDF y FacturaPDF.
// Bandas decorativas (top + bottom). Cuatro franjas con la misma `color`
// pero opacidades distintas para dar profundidad sin depender de varios
// colores ad-hoc — asi cada usuario "se reskinea" la documentacion solo
// cambiando su brand_color en Ajustes.

import { View, Text } from '@react-pdf/renderer';

export const PAGE_W = 595;
export const PAGE_H = 842;
export const MARGIN_X = 55;

// Texto fijo del pie de PDFs de FACTURA. Aclara que el documento es un
// borrador y dirige al usuario a la plataforma certificada para emitir la
// factura oficial. Lo sirve la plantilla en su area de footer.
export const PIE_OBLIGATORIO_FACTURA =
  'Documento no fiscal. Para emitir la factura oficial, exporte e importe en su sistema certificado Verifactu (Aplicación AEAT, BeeL, Holded, etc.).';

// Marca de agua diagonal "BORRADOR — DOCUMENTO NO FISCAL". Se renderiza
// SOBRE el contenido del PDF (al final del Page, no del todo del array de
// hijos) — @react-pdf no expone z-index, asi que el orden de aparicion en
// el JSX es el orden de pintado.
//
// Se monta como capa absolute que cubre la pagina entera, con el texto en
// gris y opacidad baja para no estorbar la lectura. Una sola Text con
// transform rotate -30deg, fontSize ~38pt, encaja en el ancho A4.
export function Watermark() {
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
      fixed
    >
      <Text
        style={{
          fontSize: 38,
          fontFamily: 'Helvetica-Bold',
          color: '#9aa0a6',
          opacity: 0.18,
          letterSpacing: 4,
          transform: 'rotate(-30deg)',
        }}
      >
        BORRADOR — DOCUMENTO NO FISCAL
      </Text>
    </View>
  );
}

export const TEXTO_LEGAL_DEFAULT =
  'En cumplimiento de lo dispuesto en la normativa vigente de protección de datos, le informamos de que sus datos forman parte de un fichero responsabilidad del emisor con la finalidad de gestionar la relación comercial. Puede ejercer sus derechos de acceso, rectificación, supresión y oposición en la dirección indicada.';

// Firma del producto en el pie del PDF (no es contenido legal — solo
// branding suave, debajo del texto legal y antes del bloque de contacto).
// v1.3.0: rebrand a "Ruyx Office — by RuyxLabs". El identificador BRAVA_*
// se mantiene para no reescribir 10 templates; solo cambia el string visible.
export const BRAVA_FOOTER_TEXT = 'Generado con Ruyx Office — by RuyxLabs';

// `BravaFooter` se renderiza con position absolute para que NO ocupe espacio
// en el flow del Page. Antes, al ser un Text en flow normal, @react-pdf
// detectaba contenido fluido y generaba una segunda pagina vacia, aunque
// el resto del documento cabia perfectamente en A4. `fixed` hace que se
// repita en todas las paginas si por algun motivo hay overflow real.
export function BravaFooter() {
  return (
    <Text
      style={{
        position: 'absolute',
        bottom: 12,
        left: 0,
        right: 0,
        fontSize: 6,
        color: '#999999',
        textAlign: 'center',
      }}
      fixed
    >
      {BRAVA_FOOTER_TEXT}
    </Text>
  );
}

const BAND_OPACITIES = [1, 0.85, 0.7, 0.55];

function bandStrips(color) {
  const base = color || '#1abc9c';
  return BAND_OPACITIES.map((op, i) => (
    <View
      key={i}
      style={{ flex: 1, height: '100%', backgroundColor: base, opacity: op }}
    />
  ));
}

export function BandTop({ color }) {
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 80,
        flexDirection: 'row',
      }}
    >
      {bandStrips(color)}
    </View>
  );
}

export function BandBottom({ color }) {
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 30,
        flexDirection: 'row',
      }}
    >
      {bandStrips(color)}
    </View>
  );
}
