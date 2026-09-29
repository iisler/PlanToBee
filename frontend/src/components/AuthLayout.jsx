// Giriş ve hesap ekranlarının ortak çerçevesi.
export default function AuthLayout({ subtitle, children, footer }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <img className="auth-logo" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
        <h1>PlanToBee</h1>
        {subtitle && <p className="auth-sub">{subtitle}</p>}
        {children}
        {footer}
      </div>
    </div>
  );
}
