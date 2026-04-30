import type { ReactNode } from 'react'
import clsx from 'clsx'

export function PageHeader({
  title, hint, actions,
}: { title: string; hint?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{title}</h1>
        {hint && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>}
      </div>
      {actions}
    </div>
  )
}

export function Card({
  children, className,
}: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx(
      'bg-white border border-slate-200 rounded-xl p-5',
      'dark:bg-[#111114] dark:border-white/[0.08]',
      className,
    )}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 dark:text-white mt-1">{value}</div>
      {hint && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{hint}</div>}
    </Card>
  )
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'red' | 'amber' }) {
  const t = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-slate-300',
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    red:   'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  }[tone]
  return <span className={clsx('inline-block text-xs font-medium px-2 py-0.5 rounded', t)}>{children}</span>
}

export function PrimaryButton({
  children, onClick, type = 'button', disabled, formAction,
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  formAction?: any
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      formAction={formAction}
      className="bg-accent-600 hover:bg-accent-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-2 rounded-md
                 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950"
    >
      {children}
    </button>
  )
}

export function GhostButton({
  children, onClick, type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium px-3 py-2 rounded-md
                 dark:border-white/[0.12] dark:hover:bg-white/[0.04] dark:text-slate-200"
    >
      {children}
    </button>
  )
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden
                    dark:bg-[#111114] dark:border-white/[0.08]">
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-sm text-slate-500 dark:text-slate-400 py-12 text-center">{children}</div>
}
