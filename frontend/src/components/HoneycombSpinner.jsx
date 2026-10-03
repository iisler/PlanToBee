// Yükleniyor animasyonu: logodaki petek kümesi. Ortadaki altıgen sabit; bal sarısı vurgu dıştaki altı
// altıgende saat yönünde sırayla ilerler. Animasyon CSS'tedir (index.css: .honeycomb); hareketi azalt
// ayarında durur ve tek bir sarı petek görünür.
const R = 7.2;
const DX = R * Math.sqrt(3);
// Saat yönünde, sağ üstten başlayarak
const RING = [[DX / 2, -1.5 * R], [DX, 0], [DX / 2, 1.5 * R], [-DX / 2, 1.5 * R], [-DX, 0], [-DX / 2, -1.5 * R]];

function hex(cx, cy, r) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

export default function HoneycombSpinner({ size = 40 }) {
  return (
    <svg className="honeycomb" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <polygon className="hc-core" points={hex(32, 32, R - 1.1)} />
      {RING.map(([x, y], i) => (
        <polygon key={i} className="hc-cell" style={{ animationDelay: `${i * 0.15}s` }} points={hex(32 + x, 32 + y, R - 1.1)} />
      ))}
    </svg>
  );
}
