'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export default function CashierFilter({
  staffList,
  current,
}: {
  staffList: { id: string; name: string }[]
  current?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  return (
    <select
      defaultValue={current ?? ''}
      onChange={(e) => {
        const url = new URLSearchParams(sp.toString())
        if (e.target.value) url.set('staff', e.target.value); else url.delete('staff')
        url.delete('page')   // reset to first page when filter changes
        router.push(`${pathname}?${url.toString()}`)
      }}
      className="rounded-md border border-slate-300 px-3 py-2 text-sm"
    >
      <option value="">All cashiers</option>
      {staffList.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  )
}
