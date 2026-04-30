'use client'

import { useState, useTransition } from 'react'
import { Card, PrimaryButton } from '@/components/ui'
import { createAdmin } from './actions'

// "Add admin" form. Toggles between "I'll set the password" and "generate
// for me" — the generated path is the recommended one because it returns
// a one-shot password the super sees once, sends to the new admin
// out-of-band, and forces them through /account/force-password-change.

export default function CreateAdminForm() {
  const [open, setOpen] = useState(false)
  const [generated, setGenerated] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null)
  const [revealedEmail, setRevealedEmail] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(form: HTMLFormElement) {
    setError(null)
    const fd = new FormData(form)
    const email = String(fd.get('email') ?? '')
    startTransition(async () => {
      const r = await createAdmin(fd)
      if ('error' in r && r.error) { setError(r.error); return }
      if (r.ok) {
        if (r.generatedPassword) {
          setRevealedPassword(r.generatedPassword)
          setRevealedEmail(email)
        }
        form.reset()
        setOpen(false)
      }
    })
  }

  if (!open) {
    return (
      <>
        <div className="flex justify-end mb-4">
          <PrimaryButton onClick={() => setOpen(true)}>+ Add admin</PrimaryButton>
        </div>
        {revealedPassword && revealedEmail && (
          <PasswordRevealModal
            email={revealedEmail}
            password={revealedPassword}
            onClose={() => { setRevealedPassword(null); setRevealedEmail(null) }}
          />
        )}
      </>
    )
  }

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Add admin</h2>
        <button onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit(e.currentTarget) }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Email</label>
          <input name="email" type="email" required
                 className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm
                            dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Name</label>
          <input name="name" required
                 className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm
                            dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Role</label>
          <select name="role" defaultValue="vendor_admin"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white
                             dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white">
            <option value="vendor_admin">vendor_admin</option>
            <option value="vendor_support">vendor_support</option>
            <option value="vendor_super">vendor_super</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Password</label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                name="generate_password"
                defaultChecked
                onChange={(e) => setGenerated(e.target.checked)}
              />
              Generate for me
            </label>
          </div>
          {!generated && (
            <input
              name="password" type="text" minLength={8}
              placeholder="At least 8 characters"
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono
                         dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white"
            />
          )}
        </div>

        {error && <div className="md:col-span-2 text-sm text-red-600">{error}</div>}

        <div className="md:col-span-2">
          <PrimaryButton type="submit" disabled={pending}>
            {pending ? 'Creating…' : 'Create admin'}
          </PrimaryButton>
        </div>
      </form>
      {revealedPassword && revealedEmail && (
        <PasswordRevealModal
          email={revealedEmail}
          password={revealedPassword}
          onClose={() => { setRevealedPassword(null); setRevealedEmail(null) }}
        />
      )}
    </Card>
  )
}

function PasswordRevealModal({
  email, password, onClose,
}: {
  email: string; password: string; onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6
                      dark:bg-[#16161b] dark:shadow-2xl dark:shadow-black/60 dark:ring-1 dark:ring-white/[0.06]">
        <h3 className="font-semibold mb-1 text-slate-900 dark:text-white">Temporary password</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
          Send this password to <strong>{email}</strong> securely.
          They'll be required to change it on first sign-in.
          <br />
          <strong className="text-amber-700 dark:text-amber-300">It will not be shown again.</strong>
        </p>
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 font-mono text-sm mb-4 break-all select-all
                        dark:bg-[#0d0d10] dark:border-white/[0.08] dark:text-emerald-300">
          {password}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigator.clipboard.writeText(password)}
            className="border border-slate-300 hover:bg-slate-50 text-sm font-medium px-3 py-2 rounded-md
                       dark:border-white/[0.12] dark:hover:bg-white/[0.04] dark:text-slate-200"
          >
            Copy to clipboard
          </button>
          <button
            onClick={onClose}
            className="bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium px-3 py-2 rounded-md
                       dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950"
          >
            I've saved it
          </button>
        </div>
      </div>
    </div>
  )
}
