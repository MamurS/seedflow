import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useProducts } from '../hooks/useProducts'
import { useSuppliers } from '../hooks/useSuppliers'
import type { Product, ProductInsert } from '../types/database'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { Button } from '../components/ui/Button'
import { Table } from '../components/ui/Table'
import type { Column } from '../components/ui/Table'
import { SidePanel } from '../components/ui/SidePanel'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { formatUSD } from '../lib/formatters'

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

const MAP_CURRENCIES = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
]

export function Products() {
  const { products, loading, create, update, remove } = useProducts()
  const { suppliers } = useSuppliers()

  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductInsert>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof ProductInsert, string>>>({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)

  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }))

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setPanelOpen(true)
  }

  const openEdit = (p: Product) => {
    setEditing(p)
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
    setPanelOpen(true)
  }

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
    const ok = editing ? await update(editing.id, payload) : await create(payload)
    setSaving(false)
    if (ok) setPanelOpen(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await remove(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
  }

  const setField = <K extends keyof ProductInsert>(field: K, value: ProductInsert[K]) =>
    setForm((f) => ({ ...f, [field]: value }))

  const columns: Column<Product>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'crop_type', label: 'Crop Type', sortable: true },
    { key: 'variety', label: 'Variety', render: (r) => r.variety ?? '—' },
    {
      key: 'supplier',
      label: 'Supplier',
      sortable: true,
      render: (r) => r.supplier?.name ?? '—',
    },
    {
      key: 'map_price',
      label: 'MAP Price',
      sortable: true,
      render: (r) => r.map_price != null ? `${formatUSD(r.map_price)} ${r.map_currency ?? ''}`.trim() : '—',
    },
    {
      key: 'seeds_per_pack',
      label: 'Seeds/Pack',
      render: (r) => r.seeds_per_pack?.toLocaleString() ?? '—',
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (r) => <Badge variant={r.is_active ? 'success' : 'neutral'} label={r.is_active ? 'Active' : 'Inactive'} />,
    },
    {
      key: '_actions',
      label: '',
      headerClassName: 'w-20',
      render: (r) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openEdit(r)}
            className="rounded p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="Edit"
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
        onRowClick={openEdit}
        searchKeys={['name', 'crop_type', 'variety']}
        emptyMessage="No products yet. Add your first product."
      />

      {/* Add / Edit Panel */}
      <SidePanel
        open={panelOpen}
        title={editing ? 'Edit Product' : 'Add Product'}
        onClose={() => setPanelOpen(false)}
      >
        <div className="flex flex-col gap-4">
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
          <Input
            label="Crop Type"
            value={form.crop_type}
            onChange={(e) => setField('crop_type', e.target.value)}
            error={errors.crop_type}
            required
            placeholder="e.g. Tomato, Pepper, Cucumber"
          />
          <Input
            label="Variety"
            value={form.variety ?? ''}
            onChange={(e) => setField('variety', e.target.value)}
            placeholder="e.g. Beefsteak"
          />
          <Input
            label="Seeds per Pack"
            type="number"
            value={form.seeds_per_pack ?? ''}
            onChange={(e) => setField('seeds_per_pack', e.target.value ? Number(e.target.value) : null)}
            placeholder="e.g. 1000"
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                label="MAP Price"
                type="number"
                value={form.map_price ?? ''}
                onChange={(e) => setField('map_price', e.target.value ? Number(e.target.value) : null)}
                placeholder="0.00"
              />
            </div>
            <div className="w-28">
              <Select
                label="Currency"
                value={form.map_currency ?? 'USD'}
                onChange={(e) => setField('map_currency', e.target.value)}
                options={MAP_CURRENCIES}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => setField('notes', e.target.value)}
              rows={3}
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

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 mt-2">
            <Button variant="secondary" size="sm" onClick={() => setPanelOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
              {editing ? 'Save Changes' : 'Create Product'}
            </Button>
          </div>
        </div>
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
