import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/guard'
import { PageHeader, Card, PrimaryButton } from '@/components/ui'
import Enable2FACard from './Enable2FACard'
import RegenerateCodesCard from './RegenerateCodesCard'
import { updateProfile, changePassword, disableTotp } from './actions'

export const dynamic = 'force-dynamic'

// Flash messages flow through ?ok=… / ?err=… search params (set by the
// flash() helper in actions.ts). Rendered as a banner at the top so the
// user sees what happened without losing the rest of the form.
export default async function AccountPage({
  searchParams,
}: {
  searchParams: { ok?: string; err?: string }
}) {
  const session = await requireSession()
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true, role: true,
      totpEnabled: true, totpRequired: true,
      totpRecoveryCodes: true,
    },
  })
  if (!me) return null

  const recoveryCount = Array.isArray(me.totpRecoveryCodes)
    ? me.totpRecoveryCodes.length
    : 0

  return (
    <>
      <PageHeader
        title="Account"
        hint="Edit your profile, change your password, and manage 2FA."
      />

      {searchParams.ok && (
        <div className="mb-4 max-w-3xl rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 font-medium
                        dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300">
          ✅ {searchParams.ok}
        </div>
      )}
      {searchParams.err && (
        <div className="mb-4 max-w-3xl rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 font-medium
                        dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          ⚠ {searchParams.err}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 max-w-3xl">
        {/* Profile */}
        <Card>
          <h2 className="font-semibold mb-1">Profile</h2>
          <p className="text-sm text-slate-600 mb-4">
            Your name and email are visible to other admins and on receipts you generate.
          </p>
          <form action={updateProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Name</label>
              <input
                name="name"
                defaultValue={me.name}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm
                           dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Email</label>
              <input
                name="email"
                type="email"
                defaultValue={me.email}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm
                           dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <PrimaryButton type="submit">Save profile</PrimaryButton>
            </div>
          </form>
        </Card>

        {/* Password */}
        <Card>
          <h2 className="font-semibold mb-1">Password</h2>
          <p className="text-sm text-slate-600 mb-4">
            At least 8 characters. You'll stay signed in after changing.
          </p>
          <form action={changePassword} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Current password</label>
              <input name="current_password" type="password" required autoComplete="current-password"
                     className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm
                           dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">New password</label>
              <input name="new_password" type="password" required minLength={8} autoComplete="new-password"
                     className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm
                           dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Confirm new password</label>
              <input name="confirm_password" type="password" required minLength={8} autoComplete="new-password"
                     className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm
                           dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white" />
            </div>
            <div className="sm:col-span-3">
              <PrimaryButton type="submit">Change password</PrimaryButton>
            </div>
          </form>
        </Card>

        {/* 2FA */}
        {!me.totpEnabled ? (
          <Enable2FACard userEmail={me.email} />
        ) : (
          <Card>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-emerald-700 dark:text-emerald-300 text-xs font-semibold uppercase tracking-wider">
                  ✓ 2FA enabled
                </div>
                <h2 className="font-semibold mt-0.5 text-slate-900 dark:text-white">Two-factor authentication</h2>
              </div>
              {me.totpRequired && (
                <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-1 rounded-full
                                 dark:bg-amber-500/15 dark:text-amber-300">
                  Required by admin
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              {recoveryCount} recovery code{recoveryCount === 1 ? '' : 's'} left.
              {' '}You can regenerate them or disable 2FA below.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <RegenerateCodesCard />

              {/* Disable 2FA — hidden when totpRequired */}
              {!me.totpRequired && (
                <form action={disableTotp} className="border border-slate-200 rounded-lg p-4
                                                       dark:border-white/[0.08] dark:bg-white/[0.02]">
                  <h3 className="font-medium text-sm mb-2 text-slate-900 dark:text-white">Disable 2FA</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Confirms with your password and a current code or recovery code.
                  </p>
                  <input
                    name="password" type="password" placeholder="Current password" required
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm mb-2
                               dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white"
                  />
                  <input
                    name="code" placeholder="6-digit code or recovery code" required
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono mb-3
                               dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white"
                  />
                  <button
                    type="submit"
                    className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-3 py-2 rounded-md
                               dark:bg-red-500 dark:hover:bg-red-400"
                  >
                    Disable 2FA
                  </button>
                </form>
              )}
            </div>
          </Card>
        )}
      </div>
    </>
  )
}
