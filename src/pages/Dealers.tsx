import { useState, useEffect, type ChangeEvent } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useDealers } from '../hooks/useDealers'
import type { Dealer, DealerInsert } from '../types/database'
import { PAYMENT_TERMS, PAYMENT_TERMS_LABELS } from '../lib/constants'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { Button } from '../components/ui/Button'
import { Table } from '../components/ui/Table'
import type { Column } from '../components/ui/Table'
import { SidePanel } from '../components/ui/SidePanel'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'

const EMPTY_FORM: DealerInsert = {
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  region: '',
  payment_terms: null,
  notes: '',
}

export function Dealers() {
  const { dealers, loading, create, update, remove } = useDealers()

  useEffect(() => {
    document.title = 'Dealers | SeedFlow'
    return () => { document.title = 'SeedFlow' }
  }, [])

  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing] = useState<Dealer | null>(null)
  const [form, setForm] = useState<DealerInsert>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof DealerInsert, string>>>({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Dealer | null>(null)
  const [deleting, setDeleting] = useState(false)

  const paymentTermOptions = [
    { value: '', label: '— None —' },
    ...PAYMENT_TERMS,
  ]

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setPanelOpen(true)
  }

  const openEdit = (d: Dealer) => {
    setEditing(d)
    setForm({
      name: d.name,
      contact_person: d.contact_person ?? '',
      phone: d.phone ?? '',
      email: d.email ?? '',
      region: d.region ?? '',
      payment_terms: d.payment_terms,
      notes: d.notes ?? '',
    })
    setErrors({})
    setPanelOpen(true)
  }

  const validate = (): boolean => {
    const e: typeof errors = {}
    if (!form.name.trim()) e.name = 'Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    const payload: DealerInsert = {
      name: form.name.trim(),
      contact_person: form.contact_person?.trim() || null,
      phone: form.phone?.trim() || null,
      email: form.email?.trim() || null,
      region: form.region?.trim() || null,
      payment_terms: form.payment_terms || null,
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

  const set = (field: keyof DealerInsert) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const columns: Column<Dealer>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'region', label: 'Region', sortable: true, render: (r) => r.region ?? '—' },
    { key: 'contact_person', label: 'Contact', render: (r) => r.contact_person ?? '—' },
    { key: 'phone', label: 'Phone', render: (r) => r.phone ?? '—' },
    { key: 'email', label: 'Email', render: (r) => r.email ?? '—' },
    {
      key: 'payment_terms',
      label: 'Payment Terms',
      render: (r) => r.payment_terms ? PAYMENT_TERMS_LABELS[r.payment_terms] : '—',
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
          <Breadcrumb items={[{ label: 'Dealers' }]} />
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Dealers</h1>
          <p className="text-sm text-gray-500 mt-0.5">{dealers.length} dealer{dealers.length !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={openCreate}>
          Add Dealer
        </Button>
      </div>

      <Table
        columns={columns}
        data={dealers}
        loading={loading}
        rowKey="id"
        onRowClick={openEdit}
        searchKeys={['name', 'region', 'contact_person', 'email', 'phone']}
        emptyMessage="No dealers yet. Add your first dealer."
      />

      {/* Add / Edit Panel */}
      <SidePanel
        open={panelOpen}
        title={editing ? 'Edit Dealer' : 'Add Dealer'}
        onClose={() => setPanelOpen(false)}
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Name"
            value={form.name}
            onChange={set('name')}
            error={errors.name}
            required
            placeholder="e.g. Toshkent Agro"
          />
          <Input
            label="Region"
            value={form.region ?? ''}
            onChange={set('region')}
            placeholder="e.g. Tashkent, Fergana"
          />
          <Input
            label="Contact Person"
            value={form.contact_person ?? ''}
            onChange={set('contact_person')}
            placeholder="Full name"
          />
          <Input
            label="Phone"
            value={form.phone ?? ''}
            onChange={set('phone')}
            placeholder="+998 90 123 4567"
          />
          <Input
            label="Email"
            type="email"
            value={form.email ?? ''}
            onChange={set('email')}
            placeholder="dealer@example.com"
          />
          <Select
            label="Default Payment Terms"
            value={form.payment_terms ?? ''}
            onChange={set('payment_terms')}
            options={paymentTermOptions}
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
              {editing ? 'Save Changes' : 'Create Dealer'}
            </Button>
          </div>
        </div>
      </SidePanel>

      {/* Delete Modal */}
      <Modal
        open={!!deleteTarget}
        title="Delete Dealer"
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
