import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireVendorSuper } from '@/lib/guard'
import { PageHeader, Card } from '@/components/ui'
import NewProductForm from './NewProductForm'
import ProductRowEditor from './ProductRowEditor'

export const dynamic = 'force-dynamic'

// vendor_super-only catalogue editor for the marketing site. Lists every
// product (drafts included) and shows the new-product form at the top.
//
// Not to be confused with /products/[slug] — that's the public detail
// page. The route group makes /products dispatch here for vendors and
// the slug subpath dispatch to the public page.
export default async function ProductsAdminPage() {
  await requireVendorSuper()
  const products = await prisma.product.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  const published = products.filter((p) => p.isPublished).length
  const drafts    = products.length - published

  return (
    <>
      <PageHeader
        title="Products"
        hint={`Catalogue rendered on the public marketing site at /. ${published} published, ${drafts} draft${drafts === 1 ? '' : 's'}.`}
        actions={
          <Link
            href="/"
            target="_blank"
            className="text-sm text-accent-600 hover:underline"
          >
            View landing page ↗
          </Link>
        }
      />

      <NewProductForm />

      {products.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-slate-500">
            <div className="text-3xl mb-3">📦</div>
            <div className="text-sm font-medium text-slate-700 mb-1">No products yet</div>
            <div className="text-sm">Add one with the button above.</div>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {products.map((p) => <ProductRowEditor key={p.id} product={p} />)}
        </div>
      )}
    </>
  )
}
