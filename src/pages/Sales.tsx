import { useState, useMemo, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, CheckSquare } from 'lucide-react'
import { useSales } from '../hooks/useSales'
import { useDealers } from '../hooks/useDealers'
import type { Sale, SaleInsert, SaleUpdate, PaymentTerms, PaymentStatus } from '../types/database'
import { PAYMENT_TERMS, PAYMENT_TERMS_LABELS, PAYMENT_STATUS_LABELS } from '../lib/constants'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { Button } from '../components/ui/Button'
import { Table } from '../components/ui/Table'
import type { Column } from '../components/ui/Table'
import { SidePanel } from '../components/ui/SidePanel'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { formatDate, formatUSD, formatNumber } from '../lib/formatters'

// ─── Badge maps ───────────────────────────────────────────────────────────────
const TERMS_BADGE: Record<PaymentTerms, 'success' | 'info' | 'warning' | 'orange'> = {
  prepayment: 'success',
  deferred_30: 'info',
  deferred_60: 'warning',
  deferred_90: 'orange',
}
const STATUS_BADGE: Record<PaymentStatus, 'warning' | 'orange' | 'success'> = {
  pending: 'warning',
  partial: 'orange',
  paid: 'success',
}

// ─── Form shape ───────────────────────────────────────────────────────────────
interface SaleFormState {
  dealer_id: string
  delivery_item_id: string
  sale_date: string
  quantity: string
  real_price_per_pack: string
  official_price_per_pack_uzs: string
  payment_terms: PaymentTerms
  payment_status: PaymentStatus
  payment_received_date: string
  notes: string
}

const today = new Date().toISOString().split('T')[0]

const EMPTY_FORM: SaleFormState = {
  dealer_id: '',
  delivery_item_id: '',
  sale_date: today,
  quantity: '',
  real_price_per_pack: '',
  official_price_per_pack_uzs: '',
  payment_terms: 'prepayment',
  payment_status: 'pending',
  payment_received_date: '',
  notes: '',
}

const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
]

export function Sales() {
  const { sales, deliveryItemOptions, loading, create, update, remove } = useSales()
  const { dealers } = useDealers()

  useEffect(() => {
    document.title = 'Sales | SeedFlow'
    return () => { document.title = 'SeedFlow' }
  }, [])

  // ── Filter state ────────────────────────────────────────────────────────────
  const [filterDealer, setFilterDealer] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  // ── Panel state ─────────────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing] = useState<Sale | null>(null)
  const [form, setForm] = useState<SaleFormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof SaleFormState, string>>>({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const toggleSelectAll = (currentFiltered: Sale[]) =>
    setSelectedIds((prev) =>
      prev.size === currentFiltered.length ? new Set() : new Set(currentFiltered.map((s) => s.id)),
    )

  const bulkMarkPaid = useCallback(async () => {
    setBulkUpdating(true)
    const today = new Date().toISOString().split('T')[0]
    const ids = Array.from(selectedIds)
    await Promise.all(ids.map((id) => update(id, { payment_status: 'paid', payment_received_date: today } as SaleUpdate)))
    setSelectedIds(new Set())
    setBulkUpdating(false)
  }, [selectedIds, update])

  // ── Derived data ────────────────────────────────────────────────────────────
  const dealerOptions = dealers.map((d) => ({ value: d.id, label: d.name }))
  const dealerFilterOptions = [{ value: '', label: 'All Dealers' }, ...dealerOptions]
  const statusFilterOptions = [
    { value: '', label: 'All Statuses' },
    ...PAYMENT_STATUS_OPTIONS,
  ]
  const deliveryItemSelectOptions = deliveryItemOptions.map((o) => ({ value: o.id, label: o.label }))

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (filterDealer && s.dealer_id !== filterDealer) return false
      if (filterStatus && s.payment_status !== filterStatus) return false
      if (filterFrom && s.sale_date < filterFrom) return false
      if (filterTo && s.sale_date > filterTo) return false
      return true
    })
  }, [sales, filterDealer, filterStatus, filterFrom, filterTo])

  // Auto-fill official price when delivery item is selected
  const onDeliveryItemChange = (itemId: string) => {
    const opt = deliveryItemOptions.find((o) => o.id === itemId)
    setForm((f) => ({
      ...f,
      delivery_item_id: itemId,
      official_price_per_pack_uzs: opt?.official_price_uzs != null
        ? String(opt.official_price_uzs)
        : f.official_price_per_pack_uzs,
    }))
  }

  // ── Panel open helpers ──────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setPanelOpen(true)
  }

  const openEdit = (s: Sale) => {
    setEditing(s)
    setForm({
      dealer_id: s.dealer_id,
      delivery_item_id: s.delivery_item_id,
      sale_date: s.sale_date,
      quantity: String(s.quantity),
      real_price_per_pack: String(s.real_price_per_pack),
      official_price_per_pack_uzs: s.official_price_per_pack_uzs != null
        ? String(s.official_price_per_pack_uzs)
        : '',
      payment_terms: s.payment_terms,
      payment_status: s.payment_status,
      payment_received_date: s.payment_received_date ?? '',
      notes: s.notes ?? '',
    })
    setErrors({})
    setPanelOpen(true)
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const e: typeof errors = {}
    if (!form.dealer_id) e.dealer_id = 'Dealer is required'
    if (!form.delivery_item_id) e.delivery_item_id = 'Product / delivery item is required'
    if (!form.sale_date) e.sale_date = 'Sale date is required'
    if (!form.quantity || Number(form.quantity) <= 0) e.quantity = 'Quantity must be > 0'
    if (!form.real_price_per_pack || Number(form.real_price_per_pack) <= 0)
      e.real_price_per_pack = 'Price must be > 0'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    const qty = Number(form.quantity)
    const price = Number(form.real_price_per_pack)
    const officialUzs = form.official_price_per_pack_uzs ? Number(form.official_price_per_pack_uzs) : null

    let ok: boolean
    if (editing) {
      const payload: SaleUpdate = {
        sale_date: form.sale_date,
        quantity: qty,
        real_price_per_pack: price,
        official_price_per_pack_uzs: officialUzs,
        payment_terms: form.payment_terms,
        payment_status: form.payment_status,
        payment_received_date: form.payment_received_date || null,
        notes: form.notes.trim() || null,
      }
      ok = await update(editing.id, payload, editing.delivery_item_id)
    } else {
      const payload: SaleInsert = {
        dealer_id: form.dealer_id,
        delivery_item_id: form.delivery_item_id,
        sale_date: form.sale_date,
        quantity: qty,
        real_price_per_pack: price,
        official_price_per_pack_uzs: officialUzs,
        payment_terms: form.payment_terms,
        payment_status: 'pending',
        notes: form.notes.trim() || null,
      }
      ok = await create(payload)
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

  const setField = <K extends keyof SaleFormState>(k: K, v: SaleFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  // ── Table columns ───────────────────────────────────────────────────────────
  const columns: Column<Sale>[] = [
    {
      key: '_select',
      label: '',
      headerClassName: 'w-10',
      render: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selectedIds.has(r.id)}
            onChange={() => toggleSelect(r.id)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </div>
      ),
    },
    {
      key: 'sale_date',
      label: 'Sale Date',
      sortable: true,
      render: (r) => formatDate(r.sale_date),
    },
    {
      key: 'dealer',
      label: 'Dealer',
      sortable: true,
      render: (r) => (r as unknown as { dealer?: { name: string } }).dealer?.name ?? '—',
    },
    {
      key: 'product',
      label: 'Product',
      render: (r) => {
        const di = (r as unknown as { delivery_item?: { product?: { name: string } } }).delivery_item
        return di?.product?.name ?? '—'
      },
    },
    {
      key: 'invoice',
      label: 'Invoice #',
      render: (r) => {
        const di = (r as unknown as { delivery_item?: { delivery?: { invoice_number: string | null } } }).delivery_item
        return di?.delivery?.invoice_number ?? '—'
      },
    },
    {
      key: 'quantity',
      label: 'Qty',
      sortable: true,
      render: (r) => formatNumber(r.quantity),
    },
    {
      key: 'real_price_per_pack',
      label: 'Price/Pack',
      sortable: true,
      render: (r) => formatUSD(r.real_price_per_pack),
    },
    {
      key: 'total_real_usd',
      label: 'Total USD',
      sortable: true,
      render: (r) => formatUSD(r.total_real_usd),
    },
    {
      key: 'payment_terms',
      label: 'Terms',
      render: (r) => (
        <Badge variant={TERMS_BADGE[r.payment_terms]} label={PAYMENT_TERMS_LABELS[r.payment_terms]} />
      ),
    },
    {
      key: 'payment_status',
      label: 'Status',
      sortable: true,
      render: (r) => (
        <Badge variant={STATUS_BADGE[r.payment_status]} label={PAYMENT_STATUS_LABELS[r.payment_status]} />
      ),
    },
    {
      key: 'payment_due_date',
      label: 'Due Date',
      sortable: true,
      render: (r) => {
        if (!r.payment_due_date) return <span className="text-gray-400">—</span>
        const overdue =
          r.payment_status !== 'paid' &&
          new Date(r.payment_due_date) < new Date()
        return (
          <span className={overdue ? 'font-medium text-red-600' : ''}>
            {formatDate(r.payment_due_date)}
          </span>
        )
      },
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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Breadcrumb items={[{ label: 'Sales' }]} />
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Sales</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filteredSales.length} sale{filteredSales.length !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={openCreate}>
          New Sale
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg bg-white border border-gray-200 p-4">
        <div className="flex-1 min-w-[160px]">
          <Select
            label="Dealer"
            value={filterDealer}
            onChange={(e) => setFilterDealer(e.target.value)}
            options={dealerFilterOptions}
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <Select
            label="Payment Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={statusFilterOptions}
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <Input
            label="From Date"
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <Input
            label="To Date"
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
          />
        </div>
        {(filterDealer || filterStatus || filterFrom || filterTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterDealer('')
              setFilterStatus('')
              setFilterFrom('')
              setFilterTo('')
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5">
          <input
            type="checkbox"
            checked={selectedIds.size === filteredSales.length}
            onChange={() => toggleSelectAll(filteredSales)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-blue-800">{selectedIds.size} selected</span>
          <div className="ml-2 flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={<CheckSquare size={14} />}
              onClick={bulkMarkPaid}
              loading={bulkUpdating}
            >
              Mark as Paid
            </Button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <Table
        columns={columns}
        data={filteredSales}
        loading={loading}
        rowKey="id"
        searchKeys={['sale_date']}
        emptyMessage="No sales yet. Create your first sale."
      />

      {/* New / Edit SidePanel */}
      <SidePanel
        open={panelOpen}
        title={editing ? 'Edit Sale' : 'New Sale'}
        onClose={() => setPanelOpen(false)}
      >
        <div className="flex flex-col gap-4">
          {/* Dealer */}
          <Select
            label="Dealer"
            value={form.dealer_id}
            onChange={(e) => setField('dealer_id', e.target.value)}
            options={dealerOptions}
            placeholder="Select dealer..."
            error={errors.dealer_id}
            required
            disabled={!!editing}
          />

          {/* Delivery item — only for create */}
          {!editing ? (
            <Select
              label="Product / Delivery Item"
              value={form.delivery_item_id}
              onChange={(e) => onDeliveryItemChange(e.target.value)}
              options={deliveryItemSelectOptions}
              placeholder="Select product..."
              error={errors.delivery_item_id}
              required
            />
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Product</span>
              <p className="text-sm text-gray-900 bg-gray-50 rounded-md border border-gray-200 px-3 py-2">
                {(() => {
                  const di = (editing as unknown as {
                    delivery_item?: { product?: { name: string }; delivery?: { invoice_number: string | null } }
                  }).delivery_item
                  return `${di?.product?.name ?? '—'}${di?.delivery?.invoice_number ? ` — Invoice #${di.delivery.invoice_number}` : ''}`
                })()}
              </p>
            </div>
          )}

          {/* Available stock hint */}
          {form.delivery_item_id && !editing && (
            <p className="text-xs text-gray-500 -mt-2">
              Available:{' '}
              {deliveryItemOptions.find((o) => o.id === form.delivery_item_id)?.available_qty ?? 0} packs
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Sale Date"
              type="date"
              value={form.sale_date}
              onChange={(e) => setField('sale_date', e.target.value)}
              error={errors.sale_date}
              required
            />
            <Select
              label="Payment Terms"
              value={form.payment_terms}
              onChange={(e) => setField('payment_terms', e.target.value as PaymentTerms)}
              options={PAYMENT_TERMS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantity (packs)"
              type="number"
              value={form.quantity}
              onChange={(e) => setField('quantity', e.target.value)}
              error={errors.quantity}
              required
            />
            <Input
              label="Real Price/Pack (USD)"
              type="number"
              value={form.real_price_per_pack}
              onChange={(e) => setField('real_price_per_pack', e.target.value)}
              error={errors.real_price_per_pack}
              required
            />
          </div>

          <Input
            label="Official Price/Pack (UZS)"
            type="number"
            value={form.official_price_per_pack_uzs}
            onChange={(e) => setField('official_price_per_pack_uzs', e.target.value)}
            hint="Used for inkasso registration"
          />

          {/* Totals preview */}
          {form.quantity && form.real_price_per_pack && (
            <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-sm">
              <span className="text-gray-500">Total USD: </span>
              <span className="font-semibold text-gray-900">
                {formatUSD(Number(form.quantity) * Number(form.real_price_per_pack))}
              </span>
              {form.official_price_per_pack_uzs && (
                <>
                  <span className="mx-2 text-gray-300">·</span>
                  <span className="text-gray-500">Official UZS: </span>
                  <span className="font-semibold text-gray-900">
                    {(Number(form.quantity) * Number(form.official_price_per_pack_uzs)).toLocaleString('en-US')} UZS
                  </span>
                </>
              )}
            </div>
          )}

          {/* Edit-only: payment status + received date */}
          {editing && (
            <>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Payment</p>
              </div>
              <Select
                label="Payment Status"
                value={form.payment_status}
                onChange={(e) => setField('payment_status', e.target.value as PaymentStatus)}
                options={PAYMENT_STATUS_OPTIONS}
              />
              {(form.payment_status === 'paid' || form.payment_status === 'partial') && (
                <Input
                  label="Payment Received Date"
                  type="date"
                  value={form.payment_received_date}
                  onChange={(e) => setField('payment_received_date', e.target.value)}
                />
              )}
            </>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional notes..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 mt-2">
            <Button variant="secondary" size="sm" onClick={() => setPanelOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
              {editing ? 'Save Changes' : 'Create Sale'}
            </Button>
          </div>
        </div>
      </SidePanel>

      {/* Delete Modal */}
      <Modal
        open={!!deleteTarget}
        title="Delete Sale"
        message={`Delete this sale to ${(deleteTarget as unknown as { dealer?: { name: string } })?.dealer?.name ?? 'dealer'}? This cannot be undone.`}
        danger
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )
}
