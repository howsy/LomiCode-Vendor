import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireVendor } from '@/lib/guard'
import { putObject } from '@/lib/releases/storage'
import { PageHeader, Card, Table, Badge, PrimaryButton, Empty } from '@/components/ui'
import type { UpdateChannel } from '@prisma/client'

async function uploadRelease(formData: FormData) {
  'use server'
  const session = await requireVendor()
  const version = String(formData.get('version') ?? '').trim()
  const channel = String(formData.get('channel') ?? 'stable') as UpdateChannel
  const mandatory = formData.get('mandatory') === 'on'
  const notes = String(formData.get('notes') ?? '').trim() || null
  const exe = formData.get('exe') as File | null
  const yml = formData.get('yml') as File | null

  if (!version || !exe || !yml) throw new Error('version + exe + yml all required')
  if (!/^\d+\.\d+\.\d+/.test(version)) throw new Error('version must be semver')

  const exeKey = `${version}/${exe.name}`
  const ymlKey = `${version}/${yml.name}`

  await putObject(exeKey, Buffer.from(await exe.arrayBuffer()), exe.type || 'application/octet-stream')
  await putObject(ymlKey, Buffer.from(await yml.arrayBuffer()), 'text/yaml')

  const release = await prisma.release.create({
    data: { version, channel, fileKey: exeKey, ymlKey, mandatory, notes, publishedByUserId: session.user.id },
  })
  await prisma.auditLog.create({
    data: { actorUserId: session.user.id, action: 'release.publish', targetType: 'release', targetId: release.id, payloadJson: { version, channel } },
  })
  revalidatePath('/releases')
}

export default async function ReleasesPage() {
  await requireVendor()
  const releases = await prisma.release.findMany({ orderBy: { publishedAt: 'desc' } })

  return (
    <>
      <PageHeader
        title="Releases"
        hint="Upload new POS builds. Tenants on the matching channel will pull the new version on their next launch."
      />

      <Card className="mb-6">
        <h2 className="font-semibold mb-3">Publish a new release</h2>
        <form action={uploadRelease} encType="multipart/form-data" className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Version (semver)</label>
            <input name="version" required placeholder="1.2.3" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Channel</label>
            <select name="channel" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="stable">stable</option>
              <option value="beta">beta</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Installer (.exe / .dmg / .AppImage)</label>
            <input type="file" name="exe" required className="w-full text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">electron-updater metadata (.yml)</label>
            <input type="file" name="yml" accept=".yml,.yaml,application/yaml" required className="w-full text-sm" />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="mandatory" name="mandatory" />
            <label htmlFor="mandatory" className="text-sm text-slate-700">Mandatory (auto-install, do not prompt)</label>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Release notes</label>
            <textarea name="notes" rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2"><PrimaryButton type="submit">Publish</PrimaryButton></div>
        </form>
      </Card>

      {releases.length === 0 ? (
        <Empty>No releases yet.</Empty>
      ) : (
        <Table>
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Mandatory</th>
              <th className="px-4 py-3">Published</th>
              <th className="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {releases.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-mono">{r.version}</td>
                <td className="px-4 py-3"><Badge tone={r.channel === 'stable' ? 'green' : 'amber'}>{r.channel}</Badge></td>
                <td className="px-4 py-3">{r.mandatory ? <Badge tone="red">yes</Badge> : '—'}</td>
                <td className="px-4 py-3 text-slate-500">{r.publishedAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                <td className="px-4 py-3 text-slate-600 max-w-md truncate">{r.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  )
}
