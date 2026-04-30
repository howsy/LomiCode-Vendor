'use client'

import { useState } from 'react'
import { Card, PrimaryButton, GhostButton } from '@/components/ui'
import { createProduct } from './actions'

// Same shape as the edit form, but starts blank and is collapsible so it
// doesn't dominate the page when not in use.

const SAMPLE_FEATURES = `[
  {
    "title": "Feature title",
    "description": "Why it matters in one sentence.",
    "icon": "✓"
  }
]`

export default function NewProductForm() {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <div className="flex justify-end mb-4">
        <PrimaryButton onClick={() => setOpen(true)}>+ Add product</PrimaryButton>
      </div>
    )
  }

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Add product</h2>
        <button
          onClick={() => setOpen(false)}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
      </div>
      <form action={createProduct} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name *">
            <input name="name" required placeholder="e.g. Loyalty Cards"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm
                         dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white" />
          </Field>
          <Field label="Slug" hint="Lowercase. Auto-derived from name if blank.">
            <input name="slug" placeholder="loyalty-cards"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono
                         dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white" />
          </Field>
        </div>

        <Field label="Tagline *" hint="One-line description shown on cards.">
          <input name="tagline" required placeholder="Reward repeat customers automatically."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm
                       dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white" />
        </Field>

        <Field label="Description" hint="Long-form text for the detail page.">
          <textarea name="description" rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm
                       dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white" />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Icon (emoji)">
            <input name="iconEmoji" placeholder="🎁" maxLength={4}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base" />
          </Field>
          <Field label="Accent color" hint="Hex">
            <div className="flex gap-2">
              <input
                type="color"
                defaultValue="#0f766e"
                className="w-10 h-10 rounded border border-slate-300 cursor-pointer"
                onChange={(e) => {
                  const text = (e.target.parentElement?.querySelector('input[name="accentColor"]') as HTMLInputElement)
                  if (text) text.value = e.target.value
                }}
              />
              <input name="accentColor" defaultValue="#0f766e"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" />
            </div>
          </Field>
          <Field label="Sort order">
            <input name="sortOrder" type="number" defaultValue={0}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm
                         dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white" />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="CTA label">
            <input name="ctaLabel" placeholder="Sign in"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm
                         dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white" />
          </Field>
          <Field label="CTA URL">
            <input name="ctaUrl" placeholder="/login"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono
                         dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white" />
          </Field>
        </div>

        <Field
          label="Features (JSON array)"
          hint='Each entry: { "title", "description", "icon" }'
        >
          <textarea
            name="features"
            rows={8}
            defaultValue={SAMPLE_FEATURES}
            spellCheck={false}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono
                       dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPublished" defaultChecked />
          Publish immediately
        </label>

        <div className="flex gap-2 pt-2">
          <PrimaryButton type="submit">Create product</PrimaryButton>
          <GhostButton type="button" onClick={() => setOpen(false)}>Cancel</GhostButton>
        </div>
      </form>
    </Card>
  )
}

function Field({
  label, hint, children,
}: {
  label: string; hint?: string; children: React.ReactNode
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{label}</span>
        {hint && <span className="text-[10px] text-slate-400 dark:text-slate-500">{hint}</span>}
      </div>
      {children}
    </label>
  )
}
