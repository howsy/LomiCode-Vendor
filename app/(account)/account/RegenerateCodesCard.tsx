'use client'

import { useState, useTransition } from 'react'
import { GhostButton, PrimaryButton } from '@/components/ui'
import { regenerateRecoveryCodes } from './actions'

// Replaces the previous 8 recovery codes with 8 fresh ones. The new codes
// are shown ONCE — same UX as initial enrollment — and then collapsed back
// to the password input so the user can do it again if they need to.

export default function RegenerateCodesCard({ disabled = false }: { disabled?: boolean }) {
  const [codes, setCodes] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(form: HTMLFormElement) {
    setError(null)
    const fd = new FormData(form)
    startTransition(async () => {
      const r = await regenerateRecoveryCodes(fd)
      // Discriminate on the `ok` flag: when true, `recoveryCodes` is
      // guaranteed by the action's return type. The `'error' in r` form
      // confused TS's narrowing of the union.
      if (!('ok' in r) || !r.ok) {
        setError('error' in r ? r.error : 'Failed to regenerate codes')
        return
      }
      setCodes(r.recoveryCodes)
      form.reset()
    })
  }

  return (
    <div className="border border-slate-200 rounded-lg p-4
                    dark:border-white/[0.08] dark:bg-white/[0.02]">
      <h3 className="font-medium text-sm mb-2 text-slate-900 dark:text-white">Regenerate recovery codes</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Old codes stop working immediately. Save the new ones somewhere safe.
      </p>

      {!codes ? (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(e.currentTarget) }}>
          <input
            name="password" type="password" placeholder="Current password" required
            disabled={disabled || pending}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm mb-3 disabled:opacity-50
                       dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white"
          />
          {error && <div className="text-xs text-red-600 dark:text-red-400 mb-2">{error}</div>}
          <PrimaryButton type="submit" disabled={disabled || pending}>
            {pending ? '…' : 'Regenerate'}
          </PrimaryButton>
        </form>
      ) : (
        <div>
          <div className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold mb-2">
            ✓ New recovery codes
          </div>
          <div className="grid grid-cols-2 gap-1.5 font-mono text-xs bg-white border border-slate-200 rounded p-3 mb-3
                          dark:bg-[#0d0d10] dark:border-white/[0.08] dark:text-emerald-300">
            {codes.map((c) => <div key={c} className="tracking-wider">{c}</div>)}
          </div>
          <div className="flex gap-2">
            <GhostButton onClick={() => navigator.clipboard.writeText(codes.join('\n'))}>Copy</GhostButton>
            <GhostButton onClick={() => setCodes(null)}>Done</GhostButton>
          </div>
        </div>
      )}
    </div>
  )
}
