import { prisma } from '@/lib/db'
import { requireVendorSuper } from '@/lib/guard'
import { PageHeader, Card, Table, Badge, PrimaryButton } from '@/components/ui'
import AdminRowActions from './AdminRowActions'
import CreateAdminForm from './CreateAdminForm'

export const dynamic = 'force-dynamic'

export default async function AdminsPage() {
  const session = await requireVendorSuper()
  const admins = await prisma.user.findMany({
    where: { role: { in: ['vendor_admin', 'vendor_support', 'vendor_super'] } },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true, email: true, name: true, role: true,
      isActive: true, totpEnabled: true, totpRequired: true,
      mustChangePassword: true, createdAt: true,
    },
  })

  return (
    <>
      <PageHeader
        title="Admins"
        hint="Manage vendor admin accounts. Only super-admins can see this page."
      />

      <CreateAdminForm />

      <Card className="mt-6 p-0">
        <div className="overflow-x-auto">
          <Table>
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">2FA</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {admins.map((u) => {
                const isSelf = u.id === session.user.id
                return (
                  <tr key={u.id} className={u.isActive ? '' : 'opacity-60'}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{u.name}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                      {u.mustChangePassword && (
                        <div className="text-[11px] text-amber-700 mt-0.5">
                          Pending password change
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={
                        u.role === 'vendor_super' ? 'amber' :
                        u.role === 'vendor_admin' ? 'green' : 'slate'
                      }>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {u.totpEnabled ? (
                        <span className="text-emerald-700 font-medium">✓ Enabled</span>
                      ) : (
                        <span className="text-slate-500">Off</span>
                      )}
                      {u.totpRequired && (
                        <div className="text-[11px] text-amber-700">Required</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {u.isActive ? (
                        <span className="text-emerald-700">Active</span>
                      ) : (
                        <span className="text-red-600">Disabled</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {isSelf ? (
                        <span className="text-xs text-slate-400 italic">You</span>
                      ) : (
                        <AdminRowActions user={u} />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </div>
      </Card>
    </>
  )
}
