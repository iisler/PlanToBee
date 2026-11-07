// Giriş ve hesap ekranlarının ortak çerçevesi (Görev 16): üstte petek kümesi (ortadaki koyu, bir hücre bal sarısı),
// altında beyaz kart.
export default function AuthLayout({ subtitle, children, footer }) {
  return (
    <div className="auth-wrap">
      <svg className="auth-art" viewBox="13 14 38 36" aria-hidden="true" focusable="false">
        <polygon className="c" points="32,25.9 37.28,28.95 37.28,35.05 32,38.1 26.72,35.05 26.72,28.95" />
        <polygon points="44.47,25.9 49.75,28.95 49.75,35.05 44.47,38.1 39.19,35.05 39.19,28.95" />
        <polygon points="19.53,25.9 24.81,28.95 24.81,35.05 19.53,38.1 14.25,35.05 14.25,28.95" />
        <polygon points="38.24,36.7 43.52,39.75 43.52,45.85 38.24,48.9 32.95,45.85 32.95,39.75" />
        <polygon points="25.76,36.7 31.05,39.75 31.05,45.85 25.76,48.9 20.48,45.85 20.48,39.75" />
        <polygon className="h" points="38.24,15.1 43.52,18.15 43.52,24.25 38.24,27.3 32.95,24.25 32.95,18.15" />
        <polygon points="25.76,15.1 31.05,18.15 31.05,24.25 25.76,27.3 20.48,24.25 20.48,18.15" />
      </svg>
      <div className="auth-card">
        <h1>PlanToBee</h1>
        {subtitle && <p className="auth-sub">{subtitle}</p>}
        {children}
        {footer}
      </div>
    </div>
  );
}
