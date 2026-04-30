'use client'

import { useState } from 'react'
import { payAndProvision } from './actions'

type Method = 'card' | 'super_qi' | 'zain_cash'

const METHODS: { id: Method; label: string; icon: string; tone: string }[] = [
  { id: 'card',      label: 'Card',      icon: '💳', tone: '#0ea5e9' },
  { id: 'super_qi',  label: 'Super Qi',  icon: 'SQ', tone: '#10b981' },
  { id: 'zain_cash', label: 'Zain Cash', icon: 'ZC', tone: '#dc2626' },
]

export default function PayForm({
  planId, planName, period, periodLabel, amount, currency, expiresAt,
  fingerprint, deviceUuid, tenantId, defaultName, defaultEmail,
  existingTenantName, existingTenantEmail, isPortalFlow,
}: {
  planId: string
  planName: string
  period: string
  periodLabel: string
  amount: number
  currency: string
  expiresAt: string
  fingerprint: string
  deviceUuid: string
  tenantId: string
  defaultName: string
  defaultEmail: string
  existingTenantName: string | null
  existingTenantEmail: string | null
  isPortalFlow: boolean
}) {
  // Both the POS-renewal path and the portal-upgrade path render the
  // "Subscribing as <existing name>" panel — the only difference is the
  // ribbon copy. Renewal happens when there's a prior tenant by fingerprint.
  // Portal flow always has an existing tenant (the logged-in one).
  const isRenewal = !!existingTenantName
  const [method, setMethod] = useState<Method>('card')
  const [pending, setPending] = useState(false)

  return (
    <div style={shell}>
      <div style={card}>
        {/* Demo banner */}
        <div style={demoBanner}>
          <strong>Demo mode</strong> — this is a stub. No real charge will happen until the payment provider is wired.
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#0f766e', fontWeight: 700 }}>
            LomiCode
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 0', color: '#111827' }}>Complete your subscription</h1>
        </div>

        {/* Order summary */}
        <div style={summary}>
          <div style={summaryRow}><span style={muted}>Plan</span><span style={{ fontWeight: 600 }}>{planName}</span></div>
          <div style={summaryRow}><span style={muted}>Billing</span><span style={{ fontWeight: 600 }}>{periodLabel}</span></div>
          <div style={summaryRow}><span style={muted}>Active until</span><span>{expiresAt}</span></div>
          <div style={summaryDivider} />
          <div style={{ ...summaryRow, fontSize: 18 }}>
            <span style={{ fontWeight: 600 }}>Total</span>
            <span style={{ fontWeight: 800, color: '#0f766e' }}>
              {amount.toLocaleString()} {currency}
            </span>
          </div>
        </div>

        <form
          action={async (fd) => {
            setPending(true)
            try { await payAndProvision(fd) } finally { setPending(false) }
          }}
          style={{ marginTop: 24 }}
        >
          <input type="hidden" name="planId" value={planId} />
          <input type="hidden" name="period" value={period} />
          <input type="hidden" name="fingerprint" value={fingerprint} />
          <input type="hidden" name="deviceUuid" value={deviceUuid} />
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="method" value={method} />

          {/* Customer fields */}
          {isRenewal ? (
            <>
              <div style={renewalBanner}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: '#0f766e', fontWeight: 700 }}>
                  {isPortalFlow ? 'Upgrading' : 'Subscribing as'}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginTop: 2 }}>
                  {existingTenantName}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  {isPortalFlow
                    ? 'Plan change for your existing account. The restaurant name can\'t be edited at checkout.'
                    : 'Renewing your existing account · the name can\'t be changed at checkout. To rename, sign in to your dashboard.'}
                </div>
              </div>
              {/* Hidden — server keeps the existing name regardless */}
              <input type="hidden" name="customerName" value={existingTenantName ?? ''} />
              <div style={{ marginBottom: 18 }}>
                <Label>Email (for receipt)</Label>
                <input name="customerEmail" type="email"
                  defaultValue={existingTenantEmail ?? defaultEmail}
                  placeholder="owner@restaurant.com" style={input} />
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <Label>Restaurant name</Label>
                <input name="customerName" required defaultValue={defaultName}
                  placeholder="e.g. Downtown Grill" style={input} />
              </div>
              <div style={{ marginBottom: 18 }}>
                <Label>Email (for receipt)</Label>
                <input name="customerEmail" type="email" defaultValue={defaultEmail}
                  placeholder="owner@restaurant.com" style={input} />
              </div>
            </>
          )}

          {/* Payment method picker */}
          <div style={{ marginBottom: 6 }}>
            <Label>Payment method</Label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
            {METHODS.map((m) => (
              <button key={m.id} type="button" onClick={() => setMethod(m.id)}
                style={methodTile(method === m.id, m.tone)}>
                <div style={methodIcon(m.tone)}>{m.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#171717' }}>{m.label}</div>
              </button>
            ))}
          </div>

          {/* Method-specific fields */}
          {method === 'card' && <CardFields />}
          {method === 'super_qi' && <SuperQiFields />}
          {method === 'zain_cash' && <ZainCashFields />}

          <button type="submit" disabled={pending} style={payBtn(pending)}>
            {pending ? 'Processing…' : `Pay ${amount.toLocaleString()} ${currency}`}
          </button>

          <p style={footer}>
            Secured by LomiCode. By paying you agree to the terms of service.
          </p>
        </form>
      </div>
    </div>
  )
}

function CardFields() {
  return (
    <div style={fieldGroup}>
      <Label>Card number</Label>
      <input
        type="text" inputMode="numeric" autoComplete="cc-number"
        placeholder="4242 4242 4242 4242" style={input}
        onInput={(e) => {
          const t = e.currentTarget
          t.value = t.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19)
        }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <div>
          <Label>Expiry</Label>
          <input type="text" inputMode="numeric" placeholder="MM/YY" style={input}
            onInput={(e) => {
              const t = e.currentTarget
              const v = t.value.replace(/\D/g, '').slice(0, 4)
              t.value = v.length >= 3 ? `${v.slice(0,2)}/${v.slice(2)}` : v
            }} />
        </div>
        <div>
          <Label>CVC</Label>
          <input type="text" inputMode="numeric" placeholder="123" maxLength={4} style={input} />
        </div>
      </div>
    </div>
  )
}

function SuperQiFields() {
  return (
    <div style={fieldGroup}>
      <Label>Super Qi card serial</Label>
      <input type="text" placeholder="16-digit serial" style={input} maxLength={16}
        onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '') }} />
      <div style={{ marginTop: 8 }}>
        <Label>PIN</Label>
        <input type="password" placeholder="••••••" style={input} maxLength={8} />
      </div>
    </div>
  )
}

function ZainCashFields() {
  return (
    <div style={fieldGroup}>
      <Label>Zain Cash phone number</Label>
      <input type="tel" placeholder="07XX XXX XXXX" style={input}
        onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^\d ]/g, '').slice(0, 14) }} />
      <div style={{ marginTop: 8 }}>
        <Label>OTP / wallet PIN</Label>
        <input type="password" placeholder="••••" style={input} maxLength={6} />
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>
        You'll receive an SMS to confirm the payment.
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>{children}</label>
}

// ─── Styles ───────────────────────────────────────────────────────────
const shell: React.CSSProperties = {
  minHeight: '100vh', display: 'grid', placeItems: 'center',
  background: 'linear-gradient(160deg, #f0fdf4 0%, #ecfeff 60%, #fff 100%)',
  padding: 24,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 18, padding: 32, maxWidth: 480, width: '100%',
  boxShadow: '0 30px 60px rgba(15,23,42,.12)',
}
const demoBanner: React.CSSProperties = {
  background: '#fef3c7', color: '#92400e',
  border: '1px solid #fde68a', borderRadius: 8,
  padding: '8px 12px', fontSize: 12, marginBottom: 18, textAlign: 'center',
}
const summary: React.CSSProperties = {
  background: '#f8fafc', border: '1px solid #e2e8f0',
  borderRadius: 12, padding: 16,
}
const summaryRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  fontSize: 14, padding: '4px 0',
}
const muted: React.CSSProperties = { color: '#64748b' }
const summaryDivider: React.CSSProperties = {
  height: 1, background: '#e2e8f0', margin: '8px 0',
}
const input: React.CSSProperties = {
  width: '100%', border: '1px solid #cbd5e1', borderRadius: 8,
  padding: '10px 12px', fontSize: 14, fontFamily: 'inherit',
  background: '#fff',
}
const fieldGroup: React.CSSProperties = {
  background: '#f8fafc', border: '1px solid #e2e8f0',
  borderRadius: 12, padding: 14, marginBottom: 18,
}
const renewalBanner: React.CSSProperties = {
  background: '#ecfdf5', border: '1px solid #a7f3d0',
  borderRadius: 12, padding: 14, marginBottom: 18,
}

function methodTile(active: boolean, tone: string): React.CSSProperties {
  return {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    padding: '12px 10px', cursor: 'pointer',
    background: active ? '#fff' : '#f8fafc',
    border: `2px solid ${active ? tone : '#e2e8f0'}`,
    borderRadius: 12, transition: 'border-color 120ms',
  }
}
function methodIcon(tone: string): React.CSSProperties {
  return {
    width: 36, height: 36, borderRadius: 10,
    background: tone, color: '#fff',
    display: 'grid', placeItems: 'center',
    fontWeight: 800, fontSize: 14,
  }
}
function payBtn(pending: boolean): React.CSSProperties {
  return {
    width: '100%',
    background: pending ? '#94a3b8' : '#0f766e',
    color: '#fff', border: 'none', borderRadius: 10,
    padding: '14px 16px', fontSize: 15, fontWeight: 700,
    cursor: pending ? 'wait' : 'pointer',
    boxShadow: pending ? 'none' : '0 6px 16px rgba(15,118,110,.2)',
  }
}
const footer: React.CSSProperties = {
  fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 14,
}
