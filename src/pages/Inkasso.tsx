import { useState, useMemo, useEffect } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useInkasso } from '../hooks/useInkasso'
import type { Inkasso as InkassoType, InkassoInsert, InkassoUpdate } from '../types/database'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { Button } from '../components/ui/Button'
import { Table } from '../components/ui/Table'
import type { Column } from '../components/ui/Table'
import { SidePanel } from '../components/ui/SidePanel'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { formatDate, formatUZS } from '../lib/formatters'

function currentMonthPrefix(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function lastMonthPrefix(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const today = new Date().toISOString().split('T')[0]

interface InkassoForm {
  inkasso_date: string
  total_amount_uzs: string
  notes: string
}

const EMPTY_FORM: InkassoForm = {
  inkasso_date: today,
  total_amount_uzs: '',
  notes: '',
}

export function Inkasso() {
  const { inkassos, loading, create, update, remove } = useInkasso()

  useEffect(() => {
    document.title = 'Inkasso | SeedFlow'
    return () => { document.title = 'SeedFlow' }
  }, [])

  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing] = useState<InkassoType | null>(null)
  const [form, setForm] = useState<InkassoForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof InkassoForm, string>>>({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<InkassoType | null>(null)
  const [deleting, setDeleting] = useState(false)

  const monthPrefix = currentMonthPrefix()
  const lastPrefix = lastMonthPrefix()

  const summaryCards = useMemo(() => {
    const thisYear = String(new Date().getFullYear())
    const ytd = inkassos
      .filter((i) => i.inkasso_date.startsWith(thisYear))
      .reduce((s, i) => s + i.total_amount_uzs, 0)
    const thisMonth = inkassos
      .filter((i) => i.inkasso_date.startsWith(monthPrefix))
      .reduce((s, i) => s + i.total_amount_uzs, 0)
    const lastMonth = inkassos
      .filter((i) => i.inkasso_date.startsWith(lastPrefix))
      .reduce((s, i) => s + i.total_amount_uzs, 0)
    return { ytd, thisMonth, lastMonth }
  }, [inkassos, monthPrefix, lastPrefix])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setPanelOpen(true)
  }

  const openEdit = (ink: InkassoType) => {
    setEditing(ink)
    setForm({
      inkasso_date: ink.inkasso_date,
      total_amount_uzs: String(ink.total_amount_uzs),
      notes: ink.notes ?? '',
    })
    setErrors({})
    setPanelOpen(true)
  }

  const validate = (): boolean => {
    const e: typeof errors = {}
    if (!form.inkasso_date) e.inkasso_date = 'Date is required'
    if (!form.total_amount_uzs || Number(form.total_amount_uzs) <= 0)
      e.total_amount_uzs = 'Amount must be > 0'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    if (editing) {
      const payload: InkassoUpdate = {
        inkasso_date: form.inkasso_date,
        total_amount_uzs: Number(form.total_amount_uzs),
        notes: form.notes.trim() || null,
      }
      await update(editing.id, payload)
    } else {
      const payload: InkassoInsert = {
        inkasso_date: form.inkasso_date,
        total_amount_uzs: Number(form.total_amount_uzs),
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

  const columns: Column<InkassoType>[] = [
    {
      key: 'inkasso_date',
      label: 'Date',
      sortable: true,
      render: (r) => formatDate(r.inkasso_date),
    },
    {
      key: 'total_amount_uzs',
      label: 'Amount Deposited (UZS)',
      sortable: true,
      render: (r) => (
        <span className="font-semibold text-gray-900">{formatUZS(r.total_amount_uzs)}</span>
      ),
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (r) => r.notes
        ? <span className="text-gray-600 text-xs">{r.notes}</span>
        : <span className="text-gray-300">—</span>,
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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Breadcrumb items={[{ label: 'Inkasso' }]} />
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Inkasso — Bank Deposits</h1>
          <p className="text-sm text-gray-500 mt-0.5">Cash deposited to the bank</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={openCreate}>
          Record Deposit
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Deposited YTD', value: summaryCards.ytd },
          { label: `This Month (${new Date().toLocaleDateString('en-US', { month: 'long' })})`, value: summaryCards.thisMonth },
          {
            label: `Last Month (${new Date(new Date().setMonth(new Date().getMonth() - 1)).toLocaleDateString('en-US', { month: 'long' })})`,
            value: summaryCards.lastMonth,
          },
        ].map((card) => (
          <div key={card.label} className="rounded-lg bg-white border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium">{card.label}</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{formatUZS(card.value)}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={inkassos}
        loading={loading}
        rowKey="id"
        emptyMessage="No deposits recorded yet."
      />

      {/* Record / Edit SidePanel */}
      <SidePanel
        open={panelOpen}
        title={editing ? 'Edit Deposit' : 'Record Bank Deposit'}
        onClose={() => setPanelOpen(false)}
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Date"
            type="date"
            value={form.inkasso_date}
            onChange={(e) => setField('inkasso_date', e.target.value)}
            error={errors.inkasso_date}
            required
          />
          <Input
            label="Amount Deposited (UZS)"
            type="number"
            value={form.total_amount_uzs}
            onChange={(e) => setField('total_amount_uzs', e.target.value)}
            error={errors.total_amount_uzs}
            required
            placeholder="e.g. 5000000"
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional notes (e.g. bank branch, reference number)..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 mt-2">
            <Button variant="secondary" size="sm" onClick={() => setPanelOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
              {editing ? 'Save Changes' : 'Record Deposit'}
            </Button>
          </div>
        </div>
      </SidePanel>

      {/* Delete Modal */}
      <Modal
        open={!!deleteTarget}
        title="Delete Deposit Record"
        message="Delete this inkasso deposit record?"
        danger
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )
}
