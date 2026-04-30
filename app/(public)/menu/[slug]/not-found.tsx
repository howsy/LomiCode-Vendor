export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: '#fdfaf6', color: '#1a1a1a', padding: 24,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>🍽️</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Menu not found</h1>
        <p style={{ color: '#6b6b6b', fontSize: 14, lineHeight: 1.5 }}>
          This menu link looks wrong, or the restaurant has taken its menu offline.
          Please check the QR code or ask the staff.
        </p>
      </div>
    </div>
  )
}
