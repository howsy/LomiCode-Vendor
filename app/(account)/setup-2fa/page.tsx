import { redirect } from 'next/navigation'
import { requireSessionBypassGate } from '@/lib/guard'
import { PageHeader, Card } from '@/components/ui'
import Enable2FACard from '../account/Enable2FACard'

export const dynamic = 'force-dynamic'

// Reachable only when session.user.mustEnrollTotp is true (super-admin
// flipped totpRequired and the user hasn't enrolled yet). bypass-gate
// session prevents the loop the normal requireSession would cause here.
export default async function Setup2FAPage() {
  const session = await requireSessionBypassGate()
  if (!session.user.mustEnrollTotp) redirect('/account')

  return (
    <>
      <PageHeader
        title="Enable two-factor authentication"
        hint="An administrator requires 2FA on your account before you can continue."
      />

      <div className="max-w-2xl space-y-4">
        <Card className="bg-amber-50 border-amber-200">
          <p className="text-sm text-amber-900">
            <strong>2FA is required.</strong> Set it up below — you'll need an authenticator
            app (Google Authenticator, 1Password, Authy, etc). Once enrolled, you'll
            return to your normal dashboard.
          </p>
        </Card>
        <Enable2FACard userEmail={session.user.email} />
      </div>
    </>
  )
}
