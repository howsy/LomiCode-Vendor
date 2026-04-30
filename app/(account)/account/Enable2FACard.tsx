'use client'

import { useState, useTransition } from 'react'
import { signIn } from 'next-auth/react'
import { Card, PrimaryButton, GhostButton } from '@/components/ui'
import { beginTotpEnrollment, confirmTotpEnrollment } from './actions'

// Multi-step enrollment card. Server actions do all the work; this just
// orchestrates the visible steps:
//   1. Idle → "Enable 2FA" button
//   2. Loading → fetching secret/QR
//   3. Scan + verify → show QR + 6-digit input
//   4. Save recovery codes → show codes once, require confirmation
//
// On confirmation we ask NextAuth to refresh the session so the new
// `totpEnabled` state hits the JWT immediately (instead of after the
// next sign-in).

export default function Enable2FACard({
  userEmail,
  onEnrolled,
}: {
  userEmail: string
  onEnrolled?: () => void
}) {
  const [step, setStep] = useState<'idle' | 'scan' | 'recovery'>('idle')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [acknowledged, setAcknowledged] = useState(false)
  const [pending, startTransition] = useTransition()

  function startEnrollment() {
    setError('')
    startTransition(async () => {
      const r = await beginTotpEnrollment()
      if ('error' in r && r.error) { setError(r.error); return }
      if (!r.ok) return
      setQrDataUrl(r.qrDataUrl ?? null)
      setSecret(r.secret ?? null)
      setStep('scan')
    })
  }

  function verify(form: HTMLFormElement) {
    setError('')
    const fd = new FormData(form)
    startTransition(async () => {
      const r = await confirmTotpEnrollment(fd)
      if ('error' in r && r.error) { setError(r.error); return }
      if (!r.ok) return
      setRecoveryCodes(r.recoveryCodes ?? [])
      setStep('recovery')
    })
  }

  async function finish() {
    // Refresh the JWT so mustEnrollTotp clears immediately (matters when
    // this card is rendered on /setup-2fa for a forced enrollment).
    try {
      await signIn('credentials', { redirect: false, refreshOnly: true } as any)
    } catch {
      // ignore — page will refetch session on navigate
    }
    onEnrolled?.()
    // Hard reload so server components re-fetch the session/Prisma state.
    window.location.reload()
  }

  if (step === 'idle') {
    return (
      <Card>
        <h2 className="font-semibold mb-1 text-slate-900 dark:text-white">Two-factor authentication</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
          Add a one-time code from an authenticator app (Google Authenticator, 1Password,
          Authy, …) on top of your password.
        </p>
        {error && <div className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</div>}
        <PrimaryButton onClick={startEnrollment} disabled={pending}>
          {pending ? 'Setting up…' : 'Enable 2FA'}
        </PrimaryButton>
      </Card>
    )
  }

  if (step === 'scan') {
    return (
      <Card>
        <h2 className="font-semibold mb-1 text-slate-900 dark:text-white">Scan with your authenticator app</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
          Or type the secret manually. Then enter the current 6-digit code below.
        </p>
        <div className="flex flex-col sm:flex-row gap-6 items-start mb-4">
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="2FA QR code" className="w-44 h-44 rounded-lg border border-slate-200 dark:border-white/[0.08]" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Account</div>
            <div className="text-sm mb-3 text-slate-800 dark:text-slate-200">{userEmail}</div>
            <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Manual entry secret</div>
            <code className="block text-xs font-mono break-all bg-slate-50 border border-slate-200 rounded px-2 py-1.5
                             dark:bg-[#0d0d10] dark:border-white/[0.08] dark:text-emerald-300">
              {secret}
            </code>
          </div>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); verify(e.currentTarget) }}
          className="flex items-end gap-3"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">6-digit code</label>
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="rounded-md border border-slate-300 px-3 py-2 text-base font-mono tracking-widest w-32
                         dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white"
            />
          </div>
          <PrimaryButton type="submit" disabled={pending || code.length !== 6}>
            {pending ? '...' : 'Verify & enable'}
          </PrimaryButton>
        </form>

        {error && <div className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</div>}
      </Card>
    )
  }

  // step === 'recovery'
  return (
    <Card className="border-emerald-200 bg-emerald-50/40 dark:!bg-emerald-500/[0.06] dark:!border-emerald-500/30">
      <div className="text-emerald-700 dark:text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-1">
        ✓ 2FA enabled
      </div>
      <h2 className="font-semibold mb-1 text-slate-900 dark:text-white">Save your recovery codes</h2>
      <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
        These one-time codes can sign you in if you lose access to your authenticator app.
        <strong className="block mt-1">Store them somewhere safe — they will not be shown again.</strong>
      </p>

      <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-white border border-slate-200 rounded-lg p-4 mb-4
                      dark:bg-[#0d0d10] dark:border-white/[0.08] dark:text-emerald-300">
        {recoveryCodes.map((c) => <div key={c} className="tracking-wider">{c}</div>)}
      </div>

      <div className="flex gap-3 mb-4">
        <GhostButton onClick={() => navigator.clipboard.writeText(recoveryCodes.join('\n'))}>
          Copy all
        </GhostButton>
        <GhostButton
          onClick={() => {
            const blob = new Blob([recoveryCodes.join('\n') + '\n'], { type: 'text/plain' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'lomicode-recovery-codes.txt'
            a.click()
            URL.revokeObjectURL(url)
          }}
        >
          Download .txt
        </GhostButton>
      </div>

      <label className="flex items-center gap-2 text-sm mb-4 text-slate-800 dark:text-slate-200">
        <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
        I have saved these recovery codes
      </label>

      <PrimaryButton onClick={finish} disabled={!acknowledged}>
        Done
      </PrimaryButton>
    </Card>
  )
}
