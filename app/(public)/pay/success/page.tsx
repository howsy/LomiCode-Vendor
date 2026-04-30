export const dynamic = 'force-dynamic'

const PRETTY: Record<string, string> = {
  card: 'Card',
  super_qi: 'Super Qi',
  zain_cash: 'Zain Cash',
}

export default function PaymentSuccessPage({
  searchParams,
}: { searchParams: { method?: string } }) {
  const method = searchParams.method ? (PRETTY[searchParams.method] ?? searchParams.method) : ''

  return (
    <div style={shell}>
      <div style={card}>
        <div style={successCircle}>✓</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111827', margin: '20px 0 6px' }}>
          Payment received
        </h1>
        <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
          Your subscription is active. Return to your POS terminal — it will detect
          the new license within a few seconds and unlock automatically.
        </p>
        {method && (
          <div style={meta}>
            Paid via <strong>{method}</strong>
          </div>
        )}
        <div style={{ marginTop: 24, fontSize: 12, color: '#94a3b8' }}>
          You can close this window.
        </div>
      </div>
    </div>
  )
}

const shell: React.CSSProperties = {
  minHeight: '100vh', display: 'grid', placeItems: 'center',
  background: 'linear-gradient(160deg, #f0fdf4 0%, #ecfeff 60%, #fff 100%)',
  padding: 24,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 18, padding: '40px 32px', maxWidth: 440, width: '100%',
  boxShadow: '0 30px 60px rgba(15,23,42,.12)', textAlign: 'center',
}
const successCircle: React.CSSProperties = {
  width: 72, height: 72, borderRadius: '50%',
  background: '#10b981', color: '#fff',
  fontSize: 36, fontWeight: 800,
  display: 'grid', placeItems: 'center', margin: '0 auto',
  boxShadow: '0 10px 30px rgba(16,185,129,.4)',
}
const meta: React.CSSProperties = {
  display: 'inline-block', background: '#f1f5f9',
  padding: '6px 12px', borderRadius: 999,
  fontSize: 12, color: '#475569',
}
