'use client'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useRef } from 'react'

// Two-step login:
//   1. User submits email + password.
//   2. We POST email to /api/auth/totp-required. If 2FA is on we surface
//      a code field and let them complete sign-in. If not, we sign in
//      straight away.
// This keeps the form clean for the 95% of users without 2FA while still
// supporting it cleanly when on.

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [needTotp, setNeedTotp] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const totpRef = useRef<HTMLInputElement | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')

    // Pre-check whether 2FA is on for this email. If we already showed
    // the totp field (needTotp) the user is on the second submit — skip
    // the pre-check and go straight to signIn.
    if (!needTotp) {
      try {
        const r = await fetch('/api/auth/totp-required', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        const j = await r.json()
        if (j.required) {
          setNeedTotp(true)
          setBusy(false)
          // Focus the new field so users can keep typing without reaching
          // for the mouse.
          setTimeout(() => totpRef.current?.focus(), 50)
          return
        }
      } catch {
        // network blip — fall through to signIn, the credentials provider
        // will reject if 2FA is required and we didn't supply a code
      }
    }

    const res = await signIn('credentials', { email, password, totp, redirect: false })
    setBusy(false)
    if (res?.error) {
      setError(needTotp ? 'Invalid email, password, or code' : 'Invalid email or password')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-slate-50 dark:bg-[#0a0a0c]">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white rounded-xl shadow-md p-8 border border-slate-200
                   dark:bg-[#111114] dark:border-white/[0.08] dark:shadow-2xl dark:shadow-black/40"
      >
        <div className="mb-6 text-center">
          <div className="text-xs uppercase tracking-widest text-accent-600 font-semibold dark:text-emerald-300">LomiCode</div>
          <h1 className="text-xl font-semibold mt-1 text-slate-900 dark:text-white">Sign in</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage subscriptions, reports, and your account.</p>
        </div>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Email</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setNeedTotp(false) }}
          disabled={busy}
          className="mt-1 mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500
                     dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white dark:focus:ring-emerald-500/40 dark:focus:border-emerald-500/40"
        />

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Password</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          className="mt-1 mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500
                     dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white dark:focus:ring-emerald-500/40 dark:focus:border-emerald-500/40"
        />

        {needTotp && (
          <>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Authentication code
            </label>
            <input
              ref={totpRef}
              type="text"
              inputMode="text"
              autoComplete="one-time-code"
              required
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
              placeholder="6-digit code or recovery code"
              disabled={busy}
              className="mt-1 mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-3 mb-4">
              Lost your authenticator? Enter one of your one-time recovery codes.
            </p>
          </>
        )}

        {error && <div className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-accent-600 hover:bg-accent-700 text-white font-medium py-2 text-sm disabled:opacity-60
                     dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950"
        >
          {busy ? 'Signing in...' : (needTotp ? 'Verify & sign in' : 'Continue')}
        </button>
      </form>
    </div>
  )
}
