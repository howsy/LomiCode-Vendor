import { redirect } from 'next/navigation'
import { requireSessionBypassGate } from '@/lib/guard'
import { PageHeader, Card, PrimaryButton } from '@/components/ui'
import { changePassword } from '../actions'

export const dynamic = 'force-dynamic'

// Reachable only when session.user.mustChangePassword is true. The
// requireSessionBypassGate skips the redirect-guard so we don't loop.
export default async function ForcePasswordChangePage() {
  const session = await requireSessionBypassGate()
  if (!session.user.mustChangePassword) redirect('/account')

  return (
    <>
      <PageHeader
        title="Change your password"
        hint="An administrator reset your password. Choose a new one to continue."
      />

      <Card className="max-w-lg">
        <p className="text-sm text-slate-700 mb-4">
          You can't access the rest of the app until you set a new password.
        </p>
        <form action={changePassword} className="grid grid-cols-1 gap-4">
          {/* Tells the action it's the forced flow so it uses bypass-gate session */}
          <input type="hidden" name="forced" value="1" />
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Current (temporary) password
            </label>
            <input name="current_password" type="password" required autoComplete="current-password"
                   className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">New password</label>
            <input name="new_password" type="password" required minLength={8} autoComplete="new-password"
                   className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Confirm new password</label>
            <input name="confirm_password" type="password" required minLength={8} autoComplete="new-password"
                   className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <PrimaryButton type="submit">Change password</PrimaryButton>
          </div>
        </form>
      </Card>
    </>
  )
}
