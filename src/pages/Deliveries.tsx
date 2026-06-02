import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { useDeliveries } from '../hooks/useDeliveries'
import { supabase } from '../lib/supabase'
import { toast } from '../components/ui/Toast'
import { useSuppliers } from '../hooks/useSuppliers'
import type { Delivery, DeliveryInsert } from '../types/database'
import { DELIVERY_STATUSES } from '../lib/constants'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { Button } from '../components/ui/Button'
import { Table } from '../components/ui/Table'
import type { Column } from '../components/ui/Table'
import { SidePanel } from '../components/ui/SidePanel'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { formatDate, formatUSD } from '../lib/formatters'

const EMPTY_FORM: DeliveryInsert = {
  supplier_id: '',
  invoice_number: '',
  invoice_date: '',
  order_date: '',
  status: 'ordered',
  airfreight_usd: 300,
  notes: '',
}

const STATUS_BADGE_MAP: Record<string, 'neutral' | 'info' | 'indigo' | 'warning' | 'orange' | 'teal' | 'success'> = {
  ordered: 'neutral',
  invoiced: 'info',
  paid: 'indigo',
  in_transit: 'warning',
  customs: 'orange',
  cleared: 'teal',
  delivered: 'success',
}

export function Deliveries() {
  const navigate = useNavigate()
  const { deliveries, loading, create, update, remove } = useDeliveries()

  useEffect(() => {
    document.title = 'Deliveries | SeedFlow'
    return () => { document.title = 'SeedFlow' }
  }, [])
  const { suppliers } = useSuppliers()

  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing] = useState<Delivery | null>(null)
  const [form, setForm] = useState<DeliveryInsert>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof DeliveryInsert, string>>>({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Delivery | null>(null)
  const [deleting, setDeleting] = useState(false)

  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }))
  const statusOptions = DELIVERY_STATUSES

  // Quick filter state
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const filteredDeliveries = useMemo(() => deliveries.filter((d) => {
    if (filterSupplier && d.supplier_id !== filterSupplier) return false
    if (filterStatus && d.status !== filterStatus) return false
    return true
  }), [deliveries, filterSupplier, filterStatus])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setPanelOpen(true)
  }

  const openEdit = (d: Delivery) => {
    setEditing(d)
    setForm({
      supplier_id: d.supplier_id,
      invoice_number: d.invoice_number ?? '',
      invoice_date: d.invoice_date ?? '',
      order_date: d.order_date ?? '',
      payment_date: d.payment_date ?? '',
      ship_date: d.ship_date ?? '',
      customs_start_date: d.customs_start_date ?? '',
      customs_clear_date: d.customs_clear_date ?? '',
      delivery_date: d.delivery_date ?? '',
      status: d.status,
      airfreight_usd: d.airfreight_usd,
      exchange_rate: d.exchange_rate ?? undefined,
      cycle_start_month: d.cycle_start_month ? d.cycle_start_month.slice(0, 7) : '',
      cycle_end_month: d.cycle_end_month ? d.cycle_end_month.slice(0, 7) : '',
      notes: d.notes ?? '',
    })
    setErrors({})
    setPanelOpen(true)
  }

  const validate = (): boolean => {
    const e: typeof errors = {}
    if (!form.supplier_id) e.supplier_id = 'Supplier is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)

    // Duplicate invoice# + supplier check (warn but still allow)
    const trimmedInvoice = form.invoice_number?.trim()
    if (trimmedInvoice && form.supplier_id) {
      let query = supabase
        .from('deliveries')
        .select('id')
        .eq('invoice_number', trimmedInvoice)
        .eq('supplier_id', form.supplier_id)
      if (editing) query = query.neq('id', editing.id)
      const { data: dupes } = await query
      if (dupes && dupes.length > 0) {
        toast('warning', 'Duplicate invoice', `Invoice "${trimmedInvoice}" already exists for this supplier.`)
      }
    }
    const nullify = (v: string | number | null | undefined) =>
      typeof v === 'string' ? v.trim() || null : v ?? null

    const payload: DeliveryInsert = {
      supplier_id: form.supplier_id,
      invoice_number: nullify(form.invoice_number) as string | null,
      invoice_date: nullify(form.invoice_date) as string | null,
      order_date: nullify(form.order_date) as string | null,
      payment_date: nullify(form.payment_date) as string | null,
      ship_date: nullify(form.ship_date) as string | null,
      customs_start_date: nullify(form.customs_start_date) as string | null,
      customs_clear_date: nullify(form.customs_clear_date) as string | null,
      delivery_date: nullify(form.delivery_date) as string | null,
      status: form.status,
      airfreight_usd: Number(form.airfreight_usd) || 300,
      exchange_rate: form.exchange_rate ? Number(form.exchange_rate) : null,
      cycle_start_month: form.cycle_start_month ? form.cycle_start_month + '-01' : null,
      cycle_end_month: form.cycle_end_month ? form.cycle_end_month + '-01' : null,
      notes: nullify(form.notes) as string | null,
    }

    let ok: boolean
    if (editing) {
      ok = await update(editing.id, payload)
    } else {
      const newId = await create(payload)
      if (newId) { setPanelOpen(false); navigate(`/deliveries/${newId}`); setSaving(false); return }
      ok = false
    }
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

  const setField = <K extends keyof DeliveryInsert>(k: K, v: DeliveryInsert[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const columns: Column<Delivery>[] = [
    {
      key: 'invoice_number',
      label: 'Invoice #',
      sortable: true,
      render: (r) => r.invoice_number ?? <span className="text-gray-400">—</span>,
    },
    {
      key: 'supplier',
      label: 'Supplier',
      sortable: true,
      render: (r) => r.supplier?.name ?? '—',
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (r) => (
        <Badge
          variant={STATUS_BADGE_MAP[r.status] ?? 'neutral'}
          label={DELIVERY_STATUSES.find((s) => s.value === r.status)?.label ?? r.status}
        />
      ),
    },
    {
      key: 'order_date',
      label: 'Order Date',
      sortable: true,
      render: (r) => formatDate(r.order_date),
    },
    {
      key: 'delivery_date',
      label: 'Delivery Date',
      sortable: true,
      render: (r) => formatDate(r.delivery_date),
    },
    {
      key: 'total_cip_usd',
      label: 'Total CIP',
      sortable: true,
      render: (r) => formatUSD(r.total_cip_usd),
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
          <Breadcrumb items={[{ label: 'Deliveries' }]} />
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Deliveries</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filteredDeliveries.length} of {deliveries.length} deliver{deliveries.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={openCreate}>
          New Delivery
        </Button>
      </div>

      {/* Quick filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterSupplier}
          onChange={(e) => setFilterSupplier(e.target.value)}
          className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Suppliers</option>
          {supplierOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {(filterSupplier || filterStatus) && (
          <button
            onClick={() => { setFilterSupplier(''); setFilterStatus('') }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
          >
            <X size={12} /> Clear filters
          </button>
        )}
      </div>

      <Table
        columns={columns}
        data={filteredDeliveries}
        loading={loading}
        rowKey="id"
        onRowClick={(r) => navigate(`/deliveries/${r.id}`)}
        searchKeys={['invoice_number']}
        emptyMessage="No deliveries match your filters."
      />

      {/* Add / Edit Panel */}
      <SidePanel
        open={panelOpen}
        title={editing ? 'Edit Delivery' : 'New Delivery'}
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
            label="Invoice Number"
            value={form.invoice_number ?? ''}
            onChange={(e) => setField('invoice_number', e.target.value)}
            placeholder="e.g. INV-2024-001"
          />
          <Select
            label="Status"
            value={form.status ?? 'ordered'}
            onChange={(e) => setField('status', e.target.value as DeliveryInsert['status'])}
            options={statusOptions}
          />

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Key Dates</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Order Date" type="date" value={form.order_date ?? ''} onChange={(e) => setField('order_date', e.target.value)} />
              <Input label="Invoice Date" type="date" value={form.invoice_date ?? ''} onChange={(e) => setField('invoice_date', e.target.value)} />
              <Input label="Payment Date" type="date" value={form.payment_date ?? ''} onChange={(e) => setField('payment_date', e.target.value)} />
              <Input label="Ship Date" type="date" value={form.ship_date ?? ''} onChange={(e) => setField('ship_date', e.target.value)} />
              <Input label="Customs Start" type="date" value={form.customs_start_date ?? ''} onChange={(e) => setField('customs_start_date', e.target.value)} />
              <Input label="Customs Clear" type="date" value={form.customs_clear_date ?? ''} onChange={(e) => setField('customs_clear_date', e.target.value)} />
              <Input label="Delivery Date" type="date" value={form.delivery_date ?? ''} onChange={(e) => setField('delivery_date', e.target.value)} className="col-span-2" />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Financial</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Airfreight (USD)"
                type="number"
                min="0"
                value={form.airfreight_usd ?? 300}
                onChange={(e) => setField('airfreight_usd', Number(e.target.value))}
              />
              <Input
                label="Exchange Rate"
                type="number"
                min="0"
                value={form.exchange_rate ?? ''}
                onChange={(e) => setField('exchange_rate', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="USD/UZS"
              />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">OpEx Cycle</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Cycle Start Month" type="month" value={form.cycle_start_month ?? ''} onChange={(e) => setField('cycle_start_month', e.target.value)} />
              <Input label="Cycle End Month" type="month" value={form.cycle_end_month ?? ''} onChange={(e) => setField('cycle_end_month', e.target.value)} />
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

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 mt-2">
            <Button variant="secondary" size="sm" onClick={() => setPanelOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
              {editing ? 'Save Changes' : 'Create Delivery'}
            </Button>
          </div>
        </div>
      </SidePanel>

      {/* Delete Modal */}
      <Modal
        open={!!deleteTarget}
        title="Delete Delivery"
        message={`Delete delivery "${deleteTarget?.invoice_number ?? deleteTarget?.id.slice(0, 8)}"? All items and costs will also be deleted.`}
        danger
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )
}
