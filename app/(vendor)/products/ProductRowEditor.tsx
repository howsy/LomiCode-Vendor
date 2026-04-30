'use client'

import { useState } from 'react'
import type { Product } from '@prisma/client'
import { PrimaryButton, GhostButton } from '@/components/ui'
import { updateProduct, deleteProduct } from './actions'

// Inline editor for one product row. Toggles between a compact summary
// (slug, name, status) and the full edit form. The "Features" textarea
// shows the raw JSON because the array is small (3-5 items) and lets
// the super-admin paste / edit without a custom builder UI in v1.

export default function ProductRowEditor({ product }: { product: Product }) {
  const [open, setOpen] = useState(false)
  const featuresStr = product.featuresJson
    ? JSON.stringify(product.featuresJson, null, 2)
    : ''

  if (!open) {
    return (
      <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg bg-white
                      dark:bg-[#111114] dark:border-white/[0.08]">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="w-10 h-10 rounded-lg grid place-items-center text-xl flex-shrink-0"
            style={{
              background: product.accentColor ? `${product.accentColor}26` : '#10b98126',
              border: `1px solid ${product.accentColor ?? '#10b981'}40`,
            }}
          >
            {product.iconEmoji ?? '✨'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900 dark:text-white truncate">{product.name}</span>
              {!product.isPublished && (
                <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded
                                 dark:text-amber-300 dark:bg-amber-500/15">
                  Draft
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              <span className="font-mono">/products/{product.slug}</span> · sort: {product.sortOrder}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <GhostButton onClick={() => setOpen(true)}>Edit</GhostButton>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-slate-200 rounded-lg bg-white p-5
                    dark:bg-[#111114] dark:border-white/[0.08]">
      <form action={updateProduct} className="space-y-4">
        <input type="hidden" name="id" value={product.id} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name *">
            <input name="name" defaultValue={product.name} required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm
                         dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white" />
          </Field>
          <Field label="Slug" hint="Lowercase, hyphenated. Auto-derived from name if blank.">
            <input name="slug" defaultValue={product.slug}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono
                         dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white" />
          </Field>
        </div>

        <Field label="Tagline *" hint="One-line, shown on cards and the detail-page hero.">
          <input name="tagline" defaultValue={product.tagline} required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm
                       dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white" />
        </Field>

        <Field label="Description" hint="Long-form text on the detail page. Supports newlines.">
          <textarea name="description" defaultValue={product.description ?? ''} rows={4}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm
                       dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white" />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Icon (emoji)" hint="Single emoji shown on the card.">
            <input name="iconEmoji" defaultValue={product.iconEmoji ?? ''} maxLength={4}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base" />
          </Field>
          <Field label="Accent color" hint="6-digit hex, e.g. #0f766e">
            <div className="flex gap-2">
              <input
                type="color"
                defaultValue={product.accentColor ?? '#0f766e'}
                className="w-10 h-10 rounded border border-slate-300 cursor-pointer"
                onChange={(e) => {
                  const text = (e.target.parentElement?.querySelector('input[name="accentColor"]') as HTMLInputElement)
                  if (text) text.value = e.target.value
                }}
              />
              <input name="accentColor" defaultValue={product.accentColor ?? ''} placeholder="#0f766e"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" />
            </div>
          </Field>
          <Field label="Sort order" hint="Lower numbers come first.">
            <input name="sortOrder" type="number" defaultValue={product.sortOrder}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm
                         dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white" />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="CTA label" hint='Button text on the detail page CTA, e.g. "Sign in".'>
            <input name="ctaLabel" defaultValue={product.ctaLabel ?? ''}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm
                         dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white" />
          </Field>
          <Field label="CTA URL" hint="Internal path (/login) or external URL.">
            <input name="ctaUrl" defaultValue={product.ctaUrl ?? ''} placeholder="/login"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono
                         dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white" />
          </Field>
        </div>

        <Field
          label="Features (JSON array)"
          hint='Each entry: { "title": "…", "description": "…", "icon": "✓" }'
        >
          <textarea
            name="features"
            defaultValue={featuresStr}
            rows={10}
            spellCheck={false}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono
                       dark:bg-[#0d0d10] dark:border-white/[0.1] dark:text-white"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPublished" defaultChecked={product.isPublished} />
          Published — visible on the marketing site
        </label>

        <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
          <PrimaryButton type="submit">Save changes</PrimaryButton>
          <GhostButton onClick={() => setOpen(false)} type="button">Cancel</GhostButton>
          <div className="flex-1" />
          {/* Delete is its own form so the cancel button doesn't submit it */}
          <form
            action={deleteProduct}
            onSubmit={(e) => {
              if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) e.preventDefault()
            }}
          >
            <input type="hidden" name="id" value={product.id} />
            <button
              type="submit"
              className="text-sm font-medium text-red-700 hover:text-white hover:bg-red-600 px-3 py-2 rounded-md border border-red-200 hover:border-red-600 transition-colors
                         dark:text-red-400 dark:border-red-500/30 dark:hover:bg-red-600 dark:hover:border-red-600"
            >
              Delete
            </button>
          </form>
        </div>
      </form>
    </div>
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
