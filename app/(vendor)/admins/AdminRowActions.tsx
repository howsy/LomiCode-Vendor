'use client'

import { useState, useTransition } from 'react'
import { resetAdminPassword, reset2FA, toggle2FARequired, toggleActive } from './actions'

// Per-row action surface for the /admins table. Wraps server actions so we
// can:
//   - show a one-shot password to copy after a reset (the only place the
//     super-admin sees the password — DB stores only the hash);
//   - reflect 2FA-required and active toggles without a full page reload.
//
// Confirmations use window.confirm to keep things simple — these are
// destructive but undoable (re-reset, re-enable, etc).

export default function AdminRowActions({
  user,
}: {
  user: {
    id: string
    email: string
    totpEnabled: boolean
    totpRequired: boolean
    isActive: boolean
  }
}) {
  const [pending, startTransition] = useTransition()
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function call<T extends (fd: FormData) => Promise<any>>(
    action: T,
    fields: Record<string, string>,
    confirmMsg?: string,
  ) {
    if (confirmMsg && !confirm(confirmMsg)) return
    setError(null)
    const fd = new FormData()
    fd.set('id', user.id)
    for (const [k, v] of Object.entries(fields)) fd.set(k, v)
    startTransition(async () => {
      const r = await action(fd)
      if (r?.error) setError(r.error)
      if (r?.password) setRevealedPassword(r.password)
    })
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5 justify-end">
        <button
          className="text-xs border border-slate-300 rounded px-2 py-1 hover:bg-slate-50 disabled:opacity-50
                     dark:border-white/[0.12] dark:hover:bg-white/[0.04] dark:text-slate-200"
          disabled={pending}
          onClick={() => call(
            resetAdminPassword, {},
            `Reset password for ${user.email}? They'll be forced to change it on next sign-in.`,
          )}
        >
          Reset password
        </button>

        {user.totpEnabled && (
          <button
            className="text-xs border border-slate-300 rounded px-2 py-1 hover:bg-slate-50 disabled:opacity-50
                     dark:border-white/[0.12] dark:hover:bg-white/[0.04] dark:text-slate-200"
            disabled={pending}
            onClick={() => call(
              reset2FA, {},
              `Reset 2FA for ${user.email}? They'll need to re-enroll on next sign-in.`,
            )}
          >
            Reset 2FA
          </button>
        )}

        <button
          className={`text-xs border rounded px-2 py-1 disabled:opacity-50 ${
            user.totpRequired
              ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
              : 'border-slate-300 hover:bg-slate-50'
          }`}
          disabled={pending}
          onClick={() => call(
            toggle2FARequired,
            { required: user.totpRequired ? '0' : '1' },
            user.totpRequired
              ? `Stop requiring 2FA for ${user.email}?`
              : `Require 2FA for ${user.email}? They'll be forced to enroll on next sign-in.`,
          )}
        >
          {user.totpRequired ? '✓ 2FA required' : 'Require 2FA'}
        </button>

        <button
          className={`text-xs border rounded px-2 py-1 disabled:opacity-50 ${
            user.isActive
              ? 'border-slate-300 hover:bg-slate-50'
              : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
          }`}
          disabled={pending}
          onClick={() => call(
            toggleActive,
            { active: user.isActive ? '0' : '1' },
            user.isActive ? `Deactivate ${user.email}?` : `Reactivate ${user.email}?`,
          )}
        >
          {user.isActive ? 'Deactivate' : 'Reactivate'}
        </button>
      </div>

      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}

      {revealedPassword && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setRevealedPassword(null) }}
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6
                          dark:bg-[#16161b] dark:shadow-2xl dark:shadow-black/60 dark:ring-1 dark:ring-white/[0.06]">
            <h3 className="font-semibold mb-1 text-slate-900 dark:text-white">Temporary password</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              Send this password to <strong>{user.email}</strong> securely.
              They'll be required to change it on first sign-in.
              <br />
              <strong className="text-amber-700 dark:text-amber-300">It will not be shown again.</strong>
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 font-mono text-sm mb-4 break-all select-all
                            dark:bg-[#0d0d10] dark:border-white/[0.08] dark:text-emerald-300">
              {revealedPassword}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(revealedPassword)}
                className="border border-slate-300 hover:bg-slate-50 text-sm font-medium px-3 py-2 rounded-md
                           dark:border-white/[0.12] dark:hover:bg-white/[0.04] dark:text-slate-200"
              >
                Copy to clipboard
              </button>
              <button
                onClick={() => setRevealedPassword(null)}
                className="bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium px-3 py-2 rounded-md
                           dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950"
              >
                I've saved it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
