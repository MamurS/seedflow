import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useInkasso, calcInkasso } from '../hooks/useInkasso'
import type { Inkasso as InkassoType, InkassoInsert } from '../types/database'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { Button } from '../components/ui/Button'
import { Table } from '../components/ui/Table'
import type { Column } from '../components/ui/Table'
import { SidePanel } from '../components/ui/SidePanel'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { formatDate, formatUZS, formatNumber } from '../lib/formatters'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function currentMonthPrefix(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const today = new Date().toISOString().split('T')[0]

interface InkassoForm {
  sale_id: string
  inkasso_date: string
  cash_received: string
  receipt_number: string
  notes: string
}

const EMPTY_FORM: InkassoForm = {
  sale_id: '',
  inkasso_date: today,
  cash_received: '',
  receipt_number: '',
  notes: '',
}

export function Inkasso() {
  const { inkassos, unpaidSales, loading, create, update, remove } = useInkasso()

  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing] = useState<InkassoType | null>(null)
  const [form, setForm] = useState<InkassoForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof InkassoForm, string>>>({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<InkassoType | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Monthly summary ─────────────────────────────────────────────────────────
  const monthPrefix = currentMonthPrefix()
  const thisMonthInkassos = useMemo(
    () => inkassos.filter((i) => i.inkasso_date.startsWith(monthPrefix)),
    [inkassos, monthPrefix]
  )
  const summaryCards = useMemo(() => ({
    cash: thisMonthInkassos.reduce((s, i) => s + i.cash_received, 0),
    registered: thisMonthInkassos.reduce((s, i) => s + (i.registered_amount_uzs ?? 0), 0),
    deposited: thisMonthInkassos.reduce((s, i) => s + (i.deposited_to_bank_uzs ?? 0), 0),
    difference: thisMonthInkassos.reduce((s, i) => s + (i.difference_uzs ?? 0), 0),
  }), [thisMonthInkassos])

  // ── Derived calc from selected sale for preview ─────────────────────────────
  const selectedSale = unpaidSales.find((s) => s.id === form.sale_id)
  const previewCalc = useMemo(() => {
    if (!selectedSale || !form.cash_received) return null
    if (!selectedSale.official_price_per_pack_uzs || !selectedSale.quantity) return null
    return calcInkasso(
      Number(form.cash_received),
      selectedSale.quantity,
      selectedSale.official_price_per_pack_uzs,
    )
  }, [selectedSale, form.cash_received])

  const saleOptions = unpaidSales.map((s) => ({ value: s.id, label: s.label }))

  // ── Panel helpers ───────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setPanelOpen(true)
  }

  const openEdit = (ink: InkassoType) => {
    setEditing(ink)
    setForm({
      sale_id: ink.sale_id,
      inkasso_date: ink.inkasso_date,
      cash_received: String(ink.cash_received),
      receipt_number: ink.receipt_number ?? '',
      notes: ink.notes ?? '',
    })
    setErrors({})
    setPanelOpen(true)
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const e: typeof errors = {}
    if (!editing && !form.sale_id) e.sale_id = 'Sale is required'
    if (!form.inkasso_date) e.inkasso_date = 'Date is required'
    if (!form.cash_received || Number(form.cash_received) <= 0)
      e.cash_received = 'Cash received must be > 0'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    const cashReceived = Number(form.cash_received)

    if (editing) {
      // Edit: recalculate with existing sale data from the inkasso record
      const sale = editing.sale
      let registered: number | null = null
      let deposited: number | null = null
      let difference: number | null = null
      if (sale?.official_price_per_pack_uzs && sale?.quantity) {
        const calc = calcInkasso(cashReceived, sale.quantity, sale.official_price_per_pack_uzs)
        registered = calc.registered_amount_uzs
        deposited = calc.deposited_to_bank_uzs
        difference = calc.difference_uzs
      }
      await update(editing.id, {
        inkasso_date: form.inkasso_date,
        cash_received: cashReceived,
        registered_amount_uzs: registered,
        deposited_to_bank_uzs: deposited,
        difference_uzs: difference,
        receipt_number: form.receipt_number.trim() || null,
        notes: form.notes.trim() || null,
      })
    } else {
      // Create: use preview calc
      const registered = previewCalc?.registered_amount_uzs ?? null
      const deposited = previewCalc?.deposited_to_bank_uzs ?? null
      const difference = previewCalc?.difference_uzs ?? null
      const payload: InkassoInsert = {
        sale_id: form.sale_id,
        inkasso_date: form.inkasso_date,
        cash_received: cashReceived,
        registered_amount_uzs: registered,
        deposited_to_bank_uzs: deposited,
        difference_uzs: difference,
        receipt_number: form.receipt_number.trim() || null,
        notes: form.notes.trim() || null,
      }
      await create(payload)
    }

    setSaving(false)
    setPanelOpen(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await remove(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
  }

  const setField = <K extends keyof InkassoForm>(k: K, v: InkassoForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  // ── Table columns ───────────────────────────────────────────────────────────
  type InkassoRow = InkassoType & {
    sale?: {
      sale_date?: string
      dealer?: { name: string }
      delivery_item?: { product?: { name: string } }
    }
  }

  const columns: Column<InkassoRow>[] = [
    {
      key: 'inkasso_date',
      label: 'Date',
      sortable: true,
      render: (r) => formatDate(r.inkasso_date),
    },
    {
      key: 'sale_ref',
      label: 'Sale Reference',
      render: (r) => {
        const dealer = r.sale?.dealer?.name ?? '—'
        const product = r.sale?.delivery_item?.product?.name ?? '—'
        const date = formatDate(r.sale?.sale_date ?? null)
        return (
          <div>
            <div className="font-medium text-gray-900">{dealer}</div>
            <div className="text-xs text-gray-400">{product} · {date}</div>
          </div>
        )
      },
    },
    {
      key: 'cash_received',
      label: 'Cash Received',
      sortable: true,
      render: (r) => formatUZS(r.cash_received),
    },
    {
      key: 'registered_amount_uzs',
      label: 'Registered',
      sortable: true,
      render: (r) => formatUZS(r.registered_amount_uzs),
    },
    {
      key: 'deposited_to_bank_uzs',
      label: 'Deposited',
      sortable: true,
      render: (r) => formatUZS(r.deposited_to_bank_uzs),
    },
    {
      key: 'difference_uzs',
      label: 'Difference',
      sortable: true,
      render: (r) => {
        const diff = r.difference_uzs
        if (diff == null) return <span className="text-gray-400">—</span>
        return (
          <span className={diff < 0 ? 'text-red-600 font-medium' : diff > 0 ? 'text-green-700 font-medium' : ''}>
            {formatUZS(diff)}
          </span>
        )
      },
    },
    {
      key: 'receipt_number',
      label: 'Receipt #',
      render: (r) => r.receipt_number ?? <span className="text-gray-400">—</span>,
    },
    {
      key: '_actions',
      label: '',
      headerClassName: 'w-20',
      render: (r) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openEdit(r as unknown as InkassoType)}
            className="rounded p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setDeleteTarget(r as unknown as InkassoType)}
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
          <Breadcrumb items={[{ label: 'Inkasso' }]} />
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Inkasso Collections</h1>
          <p className="text-sm text-gray-500 mt-0.5">{inkassos.length} collection{inkassos.length !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={openCreate}>
          Record Collection
        </Button>
      </div>

      {/* Monthly summary cards */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          This Month ({new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Cash Received', value: summaryCards.cash },
            { label: 'Registered (Official)', value: summaryCards.registered },
            { label: 'Deposited to Bank', value: summaryCards.deposited },
            {
              label: 'Difference',
              value: summaryCards.difference,
              colored: true,
            },
          ].map((card) => (
            <div key={card.label} className="rounded-lg bg-white border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium">{card.label}</p>
              <p className={[
                'text-lg font-semibold mt-1',
                card.colored
                  ? summaryCards.difference < 0
                    ? 'text-red-600'
                    : summaryCards.difference > 0
                      ? 'text-green-700'
                      : 'text-gray-900'
                  : 'text-gray-900',
              ].join(' ')}>
                {formatUZS(card.value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <Table
        columns={columns as unknown as Column<InkassoType>[]}
        data={inkassos as unknown as InkassoType[]}
        loading={loading}
        rowKey="id"
        emptyMessage="No inkasso collections yet."
      />

      {/* Record / Edit SidePanel */}
      <SidePanel
        open={panelOpen}
        title={editing ? 'Edit Collection' : 'Record Collection'}
        onClose={() => setPanelOpen(false)}
      >
        <div className="flex flex-col gap-4">
          {/* Sale selector — only on create */}
          {!editing ? (
            <Select
              label="Sale (unpaid / partial)"
              value={form.sale_id}
              onChange={(e) => setField('sale_id', e.target.value)}
              options={saleOptions}
              placeholder="Select sale..."
              error={errors.sale_id}
              required
            />
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Sale</span>
              <p className="text-sm text-gray-900 bg-gray-50 rounded-md border border-gray-200 px-3 py-2">
                {(() => {
                  const s = editing.sale as unknown as {
                    dealer?: { name: string }
                    delivery_item?: { product?: { name: string } }
                    sale_date?: string
                  }
                  return `${s?.dealer?.name ?? '—'} — ${s?.delivery_item?.product?.name ?? '—'} — ${formatDate(s?.sale_date)}`
                })()}
              </p>
            </div>
          )}

          {/* Official total preview from selected sale */}
          {selectedSale && !editing && (
            <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-sm">
              <span className="text-gray-500">Official Total (registered): </span>
              <span className="font-semibold text-gray-900">
                {selectedSale.total_official_uzs != null
                  ? `${formatNumber(selectedSale.total_official_uzs, 0)} UZS`
                  : selectedSale.official_price_per_pack_uzs
                    ? `${formatNumber(selectedSale.quantity * selectedSale.official_price_per_pack_uzs, 0)} UZS`
                    : '—'}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Collection Date"
              type="date"
              value={form.inkasso_date}
              onChange={(e) => setField('inkasso_date', e.target.value)}
              error={errors.inkasso_date}
              required
            />
            <Input
              label="Cash Received (UZS)"
              type="number"
              value={form.cash_received}
              onChange={(e) => setField('cash_received', e.target.value)}
              error={errors.cash_received}
              required
            />
          </div>

          {/* Auto-calc preview */}
          {previewCalc && (
            <div className="rounded-md bg-gray-50 border border-gray-200 px-4 py-3 text-sm flex flex-col gap-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Registered</span>
                <span className="font-medium">{formatUZS(previewCalc.registered_amount_uzs)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Deposited to Bank</span>
                <span className="font-medium">{formatUZS(previewCalc.deposited_to_bank_uzs)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                <span className="text-gray-500">Difference</span>
                <span className={[
                  'font-semibold',
                  previewCalc.difference_uzs < 0 ? 'text-red-600' : 'text-green-700',
                ].join(' ')}>
                  {formatUZS(previewCalc.difference_uzs)}
                </span>
              </div>
            </div>
          )}

          <Input
            label="Receipt Number"
            value={form.receipt_number}
            onChange={(e) => setField('receipt_number', e.target.value)}
            placeholder="Optional"
          />

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
              {editing ? 'Save Changes' : 'Record Collection'}
            </Button>
          </div>
        </div>
      </SidePanel>

      {/* Delete Modal */}
      <Modal
        open={!!deleteTarget}
        title="Delete Inkasso Record"
        message="Delete this collection record? The linked sale status will NOT be automatically reverted."
        danger
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )
}
