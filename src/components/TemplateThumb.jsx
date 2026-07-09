// Mini-preview de una plantilla de PDF, dibujado en HTML/CSS (no se renderiza
// el PDF real — seria muy caro). Solo es una representacion esquematica de
// como queda el documento con el color principal del usuario.

const A4_RATIO = 1.41; // alto / ancho

// Lineas de contenido falsas para llenar el cuerpo. Se renderiza siempre lo
// mismo para que el unico cambio visual entre miniaturas sea la decoracion.
function ContentLines({ marginX = '12%', marginTop = '38%', marginBottom = '20%' }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: marginX,
        right: marginX,
        top: marginTop,
        bottom: marginBottom,
        display: 'flex',
        flexDirection: 'column',
        gap: '4%',
      }}
    >
      <div style={{ height: '6%', width: '70%', background: '#cbd5e1', borderRadius: 1 }} />
      <div style={{ height: '5%', width: '90%', background: '#e2e8f0', borderRadius: 1 }} />
      <div style={{ height: '5%', width: '80%', background: '#e2e8f0', borderRadius: 1 }} />
      <div style={{ height: '5%', width: '85%', background: '#e2e8f0', borderRadius: 1 }} />
      <div style={{ height: '5%', width: '70%', background: '#e2e8f0', borderRadius: 1 }} />
    </div>
  );
}

// Cuatro segmentos con opacidades decrecientes (igual que el PDF).
function bandSegments(direction) {
  const ops = [1, 0.85, 0.7, 0.55];
  return ops.map((op, i) => (
    <div
      key={i}
      style={{
        flex: 1,
        opacity: op,
        background: 'currentColor',
      }}
    />
  ));
}

function ThumbBandas({ color }) {
  return (
    <>
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '12%',
          display: 'flex', flexDirection: 'row', color,
        }}
      >
        {bandSegments()}
      </div>
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '5%',
          display: 'flex', flexDirection: 'row', color,
        }}
      >
        {bandSegments()}
      </div>
      <ContentLines />
    </>
  );
}

function ThumbMinimal({ color }) {
  return (
    <>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, background: color }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1.5, background: color }} />
      <ContentLines marginTop="32%" />
    </>
  );
}

function ThumbCabecera({ color }) {
  return (
    <>
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '22%',
          background: color, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div
          style={{
            color: '#fff', fontWeight: 700, fontSize: 9,
            letterSpacing: 1.5,
          }}
        >
          PRESUPUESTO
        </div>
      </div>
      <ContentLines marginTop="40%" />
    </>
  );
}

function ThumbLateral({ color }) {
  return (
    <>
      <div
        style={{
          position: 'absolute', top: 0, left: 0, bottom: 0, width: '14%',
          display: 'flex', flexDirection: 'column', color,
        }}
      >
        {bandSegments()}
      </div>
      <ContentLines marginX="22%" marginTop="32%" />
    </>
  );
}

// Sidebar oscura izquierda con acento de color y contenido a la derecha.
function ThumbModerno({ color }) {
  return (
    <>
      <div
        style={{
          position: 'absolute', top: 0, left: 0, bottom: 0, width: '32%',
          background: '#1f2937',
          padding: '14% 8% 0 8%',
        }}
      >
        <div style={{ height: 6, width: '70%', background: '#fff', marginBottom: 4, borderRadius: 1 }} />
        <div style={{ height: 2, width: '30%', background: color, marginBottom: 8, borderRadius: 1 }} />
        <div style={{ height: 3, width: '60%', background: '#94a3b8', marginBottom: 14, borderRadius: 1 }} />
        <div style={{ height: 4, width: '85%', background: 'rgba(255,255,255,0.8)', marginBottom: 3, borderRadius: 1 }} />
        <div style={{ height: 3, width: '70%', background: 'rgba(255,255,255,0.5)', marginBottom: 3, borderRadius: 1 }} />
        <div style={{ height: 3, width: '75%', background: 'rgba(255,255,255,0.5)', borderRadius: 1 }} />
      </div>
      <ContentLines marginX="38%" marginTop="32%" />
      <div style={{
        position: 'absolute', top: '28%', left: '38%', right: '12%',
        height: 1.5, background: color,
      }} />
    </>
  );
}

// Banda sólida superior + franja "obra" enmarcada + caja de totales.
function ThumbConstructora({ color }) {
  return (
    <>
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '16%',
          background: color, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 8, letterSpacing: 1.5 }}>
          PRESUPUESTO
        </div>
      </div>
      <div
        style={{
          position: 'absolute', top: '20%', left: '12%', right: '12%', height: '8%',
          border: '1px solid #d4d4d4', borderRadius: 2,
        }}
      />
      <ContentLines marginTop="34%" marginBottom="22%" />
      <div
        style={{
          position: 'absolute', bottom: '8%', right: '12%', width: '36%', height: '12%',
          border: '1px solid #d4d4d4', borderRadius: 2,
        }}
      />
      <div style={{ position: 'absolute', bottom: '5%', left: 0, right: 0, height: '1.5%', background: color }} />
    </>
  );
}

// Apaisado: barra fina arriba + dos columnas (cuerpo + caja totales lateral).
function ThumbApaisado({ color }) {
  return (
    <>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3%', background: color }} />
      <div style={{ position: 'absolute', top: '8%', left: '10%', width: '40%', height: '7%', background: '#cbd5e1', borderRadius: 1 }} />
      <div
        style={{
          position: 'absolute', top: '24%', left: '10%', right: '40%', bottom: '14%',
          display: 'flex', flexDirection: 'column', gap: '5%',
        }}
      >
        <div style={{ height: '5%', background: '#e2e8f0', borderRadius: 1 }} />
        <div style={{ height: '5%', width: '90%', background: '#e2e8f0', borderRadius: 1 }} />
        <div style={{ height: '5%', width: '80%', background: '#e2e8f0', borderRadius: 1 }} />
      </div>
      <div
        style={{
          position: 'absolute', top: '24%', right: '10%', width: '24%', height: '32%',
          border: `1px solid ${color}`, borderRadius: 2,
        }}
      />
    </>
  );
}

// A5 Ticket: barra fina arriba, contenido compacto centrado.
function ThumbA5Ticket({ color }) {
  return (
    <>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2.5%', background: color }} />
      <div style={{ position: 'absolute', top: '8%', right: '14%', width: '34%', height: '6%', background: '#cbd5e1', borderRadius: 1 }} />
      <ContentLines marginX="14%" marginTop="30%" marginBottom="24%" />
      <div style={{ position: 'absolute', bottom: '14%', right: '14%', width: '40%', height: '8%', background: '#e2e8f0', borderRadius: 1 }} />
    </>
  );
}

// Membrete del usuario como thumbnail real si está subido; placeholder si no.
function ThumbPersonalizada({ color, membreteUrl }) {
  if (membreteUrl) {
    return (
      <>
        <img
          src={membreteUrl}
          alt="Membrete"
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%', objectFit: 'cover',
          }}
        />
        {/* Overlay de líneas falsas como las otras miniaturas, para que se
            vea que la plantilla dibuja datos sobre el membrete */}
        <div
          style={{
            position: 'absolute', top: '40%', left: '20%', right: '20%',
            opacity: 0.55,
          }}
        >
          <div style={{ height: 3, width: '70%', background: color, borderRadius: 1, marginBottom: 4 }} />
          <div style={{ height: 2, width: '90%', background: '#94a3b8', borderRadius: 1, marginBottom: 2 }} />
          <div style={{ height: 2, width: '80%', background: '#94a3b8', borderRadius: 1 }} />
        </div>
      </>
    );
  }
  return (
    <div
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 8, textAlign: 'center',
        background: 'repeating-linear-gradient(45deg, #f8fafc, #f8fafc 6px, #f1f5f9 6px, #f1f5f9 12px)',
      }}
    >
      <div style={{ color: '#64748b', fontSize: 9, lineHeight: 1.3 }}>
        Sube tu membrete<br />en Ajustes
      </div>
    </div>
  );
}

const THUMBS = {
  bandas: ThumbBandas,
  minimal: ThumbMinimal,
  cabecera: ThumbCabecera,
  lateral: ThumbLateral,
  moderno: ThumbModerno,
  constructora: ThumbConstructora,
  apaisado: ThumbApaisado,
  a5ticket: ThumbA5Ticket,
  personalizada: ThumbPersonalizada,
};

function TemplateThumb({ id, color, membreteUrl }) {
  const Inner = THUMBS[id] || ThumbBandas;
  return (
    <div
      style={{
        width: '100%',
        paddingTop: `${A4_RATIO * 100}%`,
        position: 'relative',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      <Inner color={color} membreteUrl={membreteUrl} />
    </div>
  );
}

export default TemplateThumb;
