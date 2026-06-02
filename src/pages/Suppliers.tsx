import { useState, useEffect, useCallback, type ChangeEvent } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSuppliers } from '../hooks/useSuppliers'
import type { Supplier, SupplierInsert } from '../types/database'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { Button } from '../components/ui/Button'
import { Table } from '../components/ui/Table'
import type { Column } from '../components/ui/Table'
import { SidePanel } from '../components/ui/SidePanel'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { formatDate } from '../lib/formatters'

const EMPTY_FORM: SupplierInsert = {
  name: '',
  country: '',
  contact_person: '',
  email: '',
  phone: '',
  payment_terms: '',
  notes: '',
}

export function Suppliers() {
  const { suppliers, loading, create, update, remove } = useSuppliers()

  useEffect(() => {
    document.title = 'Suppliers | SeedFlow'
    return () => { document.title = 'SeedFlow' }
  }, [])

  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierInsert>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof SupplierInsert, string>>>({})
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Supplier KPIs (fetched when editing panel opens)
  const [kpis, setKpis] = useState<{ deliveries: number; totalCipUsd: number; lastDelivery: string | null } | null>(null)

  const fetchKpis = useCallback(async (supplierId: string) => {
    setKpis(null)
    const { data } = await supabase
      .from('deliveries')
      .select('id, total_cip_usd, delivery_date, invoice_date')
      .eq('supplier_id', supplierId)
    if (data) {
      const sorted = [...data].sort((a, b) =>
        (b.delivery_date ?? b.invoice_date ?? '').localeCompare(a.delivery_date ?? a.invoice_date ?? ''),
      )
      setKpis({
        deliveries: data.length,
        totalCipUsd: data.reduce((s, d) => s + (d.total_cip_usd ?? 0), 0),
        lastDelivery: sorted[0]?.delivery_date ?? sorted[0]?.invoice_date ?? null,
      })
    }
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setPanelOpen(true)
  }

  const openEdit = (s: Supplier) => {
    setEditing(s)
    fetchKpis(s.id)
    setForm({
      name: s.name,
      country: s.country,
      contact_person: s.contact_person ?? '',
      email: s.email ?? '',
      phone: s.phone ?? '',
      payment_terms: s.payment_terms ?? '',
      notes: s.notes ?? '',
    })
    setErrors({})
    setPanelOpen(true)
  }

  const validate = (): boolean => {
    const e: typeof errors = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.country.trim()) e.country = 'Country is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    const payload: SupplierInsert = {
      name: form.name.trim(),
      country: form.country.trim(),
      contact_person: form.contact_person?.trim() || null,
      email: form.email?.trim() || null,
      phone: form.phone?.trim() || null,
      payment_terms: form.payment_terms?.trim() || null,
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

  const set = (field: keyof SupplierInsert) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const columns: Column<Supplier>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'country', label: 'Country', sortable: true },
    { key: 'contact_person', label: 'Contact', render: (r) => r.contact_person ?? '—' },
    { key: 'email', label: 'Email', render: (r) => r.email ?? '—' },
    { key: 'phone', label: 'Phone', render: (r) => r.phone ?? '—' },
    { key: 'payment_terms', label: 'Payment Terms', render: (r) => r.payment_terms ?? '—' },
    { key: 'created_at', label: 'Added', sortable: true, render: (r) => formatDate(r.created_at) },
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
          <Breadcrumb items={[{ label: 'Suppliers' }]} />
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-0.5">{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={openCreate}>
          Add Supplier
        </Button>
      </div>

      <Table
        columns={columns}
        data={suppliers}
        loading={loading}
        rowKey="id"
        onRowClick={openEdit}
        searchKeys={['name', 'country', 'contact_person', 'email']}
        emptyMessage="No suppliers yet. Add your first supplier."
      />

      {/* Add / Edit Panel */}
      <SidePanel
        open={panelOpen}
        title={editing ? 'Edit Supplier' : 'Add Supplier'}
        onClose={() => setPanelOpen(false)}
      >
        <div className="flex flex-col gap-4">
          {editing && (
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 border border-gray-200 p-3">
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">{kpis?.deliveries ?? '—'}</p>
                <p className="text-xs text-gray-500">Deliveries</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">
                  {kpis ? `$${Math.round(kpis.totalCipUsd).toLocaleString()}` : '—'}
                </p>
                <p className="text-xs text-gray-500">Total CIP (USD)</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700">
                  {kpis?.lastDelivery ? new Date(kpis.lastDelivery).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                </p>
                <p className="text-xs text-gray-500">Last Delivery</p>
              </div>
            </div>
          )}
          <Input
            label="Name"
            value={form.name}
            onChange={set('name')}
            error={errors.name}
            required
            placeholder="e.g. Syngenta"
          />
          <Input
            label="Country"
            value={form.country}
            onChange={set('country')}
            error={errors.country}
            required
            placeholder="e.g. Netherlands"
          />
          <Input
            label="Contact Person"
            value={form.contact_person ?? ''}
            onChange={set('contact_person')}
            placeholder="Full name"
          />
          <Input
            label="Email"
            type="email"
            value={form.email ?? ''}
            onChange={set('email')}
            placeholder="contact@supplier.com"
          />
          <Input
            label="Phone"
            value={form.phone ?? ''}
            onChange={set('phone')}
            placeholder="+1 234 567 8900"
          />
          <Input
            label="Payment Terms"
            value={form.payment_terms ?? ''}
            onChange={set('payment_terms')}
            placeholder="e.g. Net 30, Prepayment"
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={form.notes ?? ''}
              onChange={set('notes')}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Optional notes..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 mt-2">
            <Button variant="secondary" size="sm" onClick={() => setPanelOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
              {editing ? 'Save Changes' : 'Create Supplier'}
            </Button>
          </div>
        </div>
      </SidePanel>

      {/* Delete Modal */}
      <Modal
        open={!!deleteTarget}
        title="Delete Supplier"
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
