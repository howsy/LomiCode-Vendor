'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export default function DateRangePicker() {
  const router = useRouter()
  const sp = useSearchParams()
  const pathname = usePathname()
  const from = sp.get('from') ?? ''
  const to = sp.get('to') ?? ''

  function update(next: Record<string, string>) {
    const url = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(next)) v ? url.set(k, v) : url.delete(k)
    router.push(`${pathname}?${url.toString()}`)
  }

  return (
    <div className="flex items-end gap-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
        <input type="date" defaultValue={from} onChange={(e) => update({ from: e.target.value })}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
        <input type="date" defaultValue={to} onChange={(e) => update({ to: e.target.value })}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>
    </div>
  )
}
