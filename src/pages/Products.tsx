import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Package, History } from 'lucide-react'
import { useProducts } from '../hooks/useProducts'
import type { ProductWithStats, DeliveryItemImport } from '../hooks/useProducts'
import { useSuppliers } from '../hooks/useSuppliers'
import type { ProductInsert } from '../types/database'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { Button } from '../components/ui/Button'
import { Table } from '../components/ui/Table'
import type { Column } from '../components/ui/Table'
import { SidePanel } from '../components/ui/SidePanel'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { formatUSD, formatUZS, formatPct, formatDate } from '../lib/formatters'

const EMPTY_FORM: ProductInsert = {
  supplier_id: '',
  name: '',
  crop_type: '',
  variety: '',
  unit: 'pack',
  seeds_per_pack: null,
  map_price: null,
  map_currency: 'USD',
  notes: '',
  is_active: true,
}

type PanelMode = 'create' | 'detail' | null
type DetailTab = 'info' | 'history'

export function Products() {
  const { products, importsByProduct, soldByDeliveryItem, loading, create, update, updateImportNotes, remove } = useProducts()
  const { suppliers } = useSuppliers()

  useEffect(() => {
    document.title = 'Products | SeedFlow'
    return () => { document.title = 'SeedFlow' }
  }, [])

  const [panelMode, setPanelMode] = useState<PanelMode>(null)
  const [selectedProduct, setSelectedProduct] = useState<ProductWithStats | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('info')
  const [form, setForm] = useState<ProductInsert>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof ProductInsert, string>>>({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProductWithStats | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Import notes inline editing
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
  const [notesEdit, setNotesEdit] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }))

  // ── Open handlers ─────────────────────────────────────────────────────────────
  const openCreate = () => {
    setSelectedProduct(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setPanelMode('create')
  }

  const openDetail = (p: ProductWithStats, tab: DetailTab = 'history') => {
    setSelectedProduct(p)
    setForm({
      supplier_id: p.supplier_id,
      name: p.name,
      crop_type: p.crop_type,
      variety: p.variety ?? '',
      unit: p.unit,
      seeds_per_pack: p.seeds_per_pack,
      map_price: p.map_price,
      map_currency: p.map_currency ?? 'USD',
      notes: p.notes ?? '',
      is_active: p.is_active,
    })
    setErrors({})
    setDetailTab(tab)
    setPanelMode('detail')
  }

  const closePanel = () => {
    setPanelMode(null)
    setSelectedProduct(null)
    setEditingNotesId(null)
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const e: typeof errors = {}
    if (!form.supplier_id) e.supplier_id = 'Supplier is required'
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.crop_type.trim()) e.crop_type = 'Crop type is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    const payload: ProductInsert = {
      ...form,
      name: form.name.trim(),
      crop_type: form.crop_type.trim(),
      variety: form.variety?.trim() || null,
      notes: form.notes?.trim() || null,
    }
    const ok = selectedProduct
      ? await update(selectedProduct.id, payload)
      : await create(payload)
    setSaving(false)
    if (ok) {
      if (!selectedProduct) {
        closePanel()
      }
      // In detail mode, stay open so user can see the change reflected
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await remove(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    if (panelMode === 'detail' && selectedProduct?.id === deleteTarget.id) closePanel()
  }

  const handleSaveNotes = async (item: DeliveryItemImport) => {
    setSavingNotes(true)
    await updateImportNotes(item.id, notesEdit.trim() || null)
    setSavingNotes(false)
    setEditingNotesId(null)
  }

  const setField = <K extends keyof ProductInsert>(field: K, value: ProductInsert[K]) =>
    setForm((f) => ({ ...f, [field]: value }))

  // ── Table columns ─────────────────────────────────────────────────────────────
  const columns: Column<ProductWithStats>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (r) => (
        <div>
          <div className="font-medium text-gray-900">{r.name}</div>
          {r.variety && <div className="text-xs text-gray-400">{r.variety}</div>}
        </div>
      ),
    },
    { key: 'crop_type', label: 'Crop Type', sortable: true },
    {
      key: 'supplier',
      label: 'Supplier',
      sortable: true,
      render: (r) => r.supplier?.name ?? '—',
    },
    {
      key: 'seeds_per_pack',
      label: 'Seeds/Pack',
      render: (r) => r.seeds_per_pack?.toLocaleString() ?? '—',
    },
    {
      key: 'importCount',
      label: 'Imports',
      sortable: true,
      render: (r) => (
        <span className={r.importCount === 0 ? 'text-gray-400' : 'font-medium text-gray-900'}>
          {r.importCount === 0 ? '—' : r.importCount}
        </span>
      ),
    },
    {
      key: 'latestCip',
      label: 'Latest CIP',
      sortable: true,
      render: (r) => r.latestCip != null
        ? <span className="font-medium text-gray-900">{formatUSD(r.latestCip)}</span>
        : <span className="text-gray-400">—</span>,
    },
    {
      key: 'latestRetailPrice',
      label: 'Latest Retail',
      sortable: true,
      render: (r) => r.latestRetailPrice != null
        ? <span className="font-medium text-emerald-700">{formatUSD(r.latestRetailPrice)}</span>
        : <span className="text-gray-400">—</span>,
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (r) => <Badge variant={r.is_active ? 'success' : 'neutral'} label={r.is_active ? 'Active' : 'Inactive'} />,
    },
    {
      key: '_actions',
      label: '',
      headerClassName: 'w-24',
      render: (r) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openDetail(r, 'info')}
            className="rounded p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="Edit product info"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setDeleteTarget(r)}
            className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]

  // ── Panel title ───────────────────────────────────────────────────────────────
  const panelTitle = panelMode === 'create'
    ? 'Add Product'
    : selectedProduct?.name ?? 'Product'

  // Import history for selected product
  const imports = selectedProduct ? (importsByProduct.get(selectedProduct.id) ?? []) : []

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <Breadcrumb items={[{ label: 'Products' }]} />
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">{products.length} product{products.length !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={openCreate}>
          Add Product
        </Button>
      </div>

      <Table
        columns={columns}
        data={products}
        loading={loading}
        rowKey="id"
        onRowClick={(r) => openDetail(r, 'history')}
        searchKeys={['name', 'crop_type', 'variety']}
        emptyMessage="No products yet. Add your first product."
      />

      {/* Product SidePanel — create or detail */}
      <SidePanel
        open={panelMode !== null}
        title={panelTitle}
        onClose={closePanel}
      >
        {panelMode === 'create' ? (
          // ── Create form (no tabs) ──────────────────────────────────────────────
          <div className="flex flex-col gap-4">
            <ProductInfoForm
              form={form}
              errors={errors}
              supplierOptions={supplierOptions}
              setField={setField}
            />
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 mt-2">
              <Button variant="secondary" size="sm" onClick={closePanel} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
                Create Product
              </Button>
            </div>
          </div>
        ) : selectedProduct ? (
          // ── Detail view with tabs ──────────────────────────────────────────────
          <div className="flex flex-col gap-0">
            {/* Tabs */}
            <div className="border-b border-gray-200 -mx-6 px-6 mb-4">
              <nav className="flex gap-1 -mb-px">
                {(['info', 'history'] as DetailTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    className={[
                      'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors',
                      detailTab === tab
                        ? 'border-[#1a56db] text-[#1a56db]'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                    ].join(' ')}
                  >
                    {tab === 'info' ? (
                      <><Package size={14} /> Product Info</>
                    ) : (
                      <><History size={14} /> Import History {imports.length > 0 && `(${imports.length})`}</>
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab: Info */}
            {detailTab === 'info' && (
              <div className="flex flex-col gap-4">
                <ProductInfoForm
                  form={form}
                  errors={errors}
                  supplierOptions={supplierOptions}
                  setField={setField}
                />
                <div className="flex items-center justify-between pt-2 border-t border-gray-200 mt-2">
                  <button
                    onClick={() => setDeleteTarget(selectedProduct)}
                    className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1"
                  >
                    <Trash2 size={14} /> Delete product
                  </button>
                  <div className="flex gap-3">
                    <Button variant="secondary" size="sm" onClick={closePanel} disabled={saving}>
                      Close
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
                      Save Changes
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Import History */}
            {detailTab === 'history' && (
              <div className="flex flex-col gap-3">
                {imports.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">
                    This product has not been imported yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-6">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-y border-gray-200">
                          {['Delivery', 'Date', 'CIP/pack', 'Rec. Price', 'Official UZS', 'Margin', 'Qty', 'Sold', 'Notes', ''].map((h) => (
                            <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {imports.map((item) => {
                          const displayDate = item.delivery?.delivery_date || item.delivery?.invoice_date
                          const isEditingThis = editingNotesId === item.id
                          return (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                                {item.delivery?.invoice_number ?? '—'}
                              </td>
                              <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                                {displayDate ? formatDate(displayDate) : '—'}
                              </td>
                              <td className="px-3 py-2 text-gray-900 whitespace-nowrap font-medium">
                                {formatUSD(item.cip_price_usd)}
                              </td>
                              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                                {item.recommended_price_usd != null
                                  ? formatUSD(item.recommended_price_usd)
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                                {item.official_price_uzs != null
                                  ? formatUZS(item.official_price_uzs)
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                                {formatPct(item.margin_pct)}
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {item.quantity.toLocaleString()}
                              </td>
                              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                                {(() => {
                                  const sold = soldByDeliveryItem.get(item.id) ?? 0
                                  return sold > 0
                                    ? <span className="font-medium text-emerald-700">{sold.toLocaleString()}</span>
                                    : <span className="text-gray-300">—</span>
                                })()}
                              </td>
                              <td className="px-3 py-2 min-w-[120px]">
                                {isEditingThis ? (
                                  <input
                                    type="text"
                                    value={notesEdit}
                                    onChange={(e) => setNotesEdit(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveNotes(item)
                                      if (e.key === 'Escape') setEditingNotesId(null)
                                    }}
                                    className="w-full rounded border border-blue-400 px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    autoFocus
                                    disabled={savingNotes}
                                  />
                                ) : (
                                  <span className="text-xs text-gray-500">
                                    {item.notes ?? <span className="text-gray-300">—</span>}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {isEditingThis ? (
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleSaveNotes(item)}
                                      disabled={savingNotes}
                                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingNotesId(null)}
                                      className="text-xs text-gray-400 hover:text-gray-600"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingNotesId(item.id)
                                      setNotesEdit(item.notes ?? '')
                                    }}
                                    className="rounded p-1 text-gray-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                    title="Edit notes"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex justify-end pt-2 border-t border-gray-200">
                  <Button variant="secondary" size="sm" onClick={closePanel}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </SidePanel>

      {/* Delete Modal */}
      <Modal
        open={!!deleteTarget}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        danger
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )
}

// ── Extracted form component to avoid repetition ──────────────────────────────
function ProductInfoForm({
  form,
  errors,
  supplierOptions,
  setField,
}: {
  form: ProductInsert
  errors: Partial<Record<keyof ProductInsert, string>>
  supplierOptions: { value: string; label: string }[]
  setField: <K extends keyof ProductInsert>(field: K, value: ProductInsert[K]) => void
}) {
  return (
    <>
      <Select
        label="Supplier"
        value={form.supplier_id}
        onChange={(e) => setField('supplier_id', e.target.value)}
        options={supplierOptions}
        placeholder="Select supplier..."
        error={errors.supplier_id}
        required
      />
      <Input
        label="Product Name"
        value={form.name}
        onChange={(e) => setField('name', e.target.value)}
        error={errors.name}
        required
        placeholder="e.g. Tomato F1 Hybrid"
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Crop Type"
          value={form.crop_type}
          onChange={(e) => setField('crop_type', e.target.value)}
          error={errors.crop_type}
          required
          placeholder="e.g. Tomato"
        />
        <Input
          label="Variety"
          value={form.variety ?? ''}
          onChange={(e) => setField('variety', e.target.value)}
          placeholder="e.g. Beefsteak"
        />
      </div>
      <Input
        label="Seeds per Pack"
        type="number"
        value={form.seeds_per_pack ?? ''}
        onChange={(e) => setField('seeds_per_pack', e.target.value ? Number(e.target.value) : null)}
        placeholder="e.g. 1000"
      />
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Notes</label>
        <textarea
          value={form.notes ?? ''}
          onChange={(e) => setField('notes', e.target.value)}
          rows={2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Optional notes..."
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_active"
          checked={form.is_active ?? true}
          onChange={(e) => setField('is_active', e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
      </div>
    </>
  )
}
