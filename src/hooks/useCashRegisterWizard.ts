import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { CashRegisterInsert, InkassoInsert } from '../types/database'
import { toast } from '../components/ui/Toast'

export interface WizardItem {
  delivery_item_id: string
  product_name: string
  variety: string | null
  invoice_number: string | null
  official_price_uzs: number
  sellable_qty: number
  registered_packs: number
  remaining_packs: number
}

export interface ReceiptLine {
  item: WizardItem
  qty: number
  line_total_uzs: number
}

export interface WizardReceipt {
  lines: ReceiptLine[]
  total_uzs: number
  receipt_number: string
}

export interface WizardSettings {
  daily_limit_uzs: number
  max_receipt_uzs: number
  min_receipt_uzs: number
}

const DEFAULT_SETTINGS: WizardSettings = {
  daily_limit_uzs: 100_000_000,
  max_receipt_uzs: 24_000_000,
  min_receipt_uzs: 1_000_000,
}

function loadSettings(): WizardSettings {
  try {
    const raw = localStorage.getItem('cashRegisterWizardSettings')
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS
}

function saveSettings(s: WizardSettings) {
  localStorage.setItem('cashRegisterWizardSettings', JSON.stringify(s))
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function receiptNumber(sessionDate: string, index: number) {
  return `SES-${sessionDate.replace(/-/g, '')}-${String(index).padStart(3, '0')}`
}

function buildReceipt(
  items: WizardItem[],
  settings: WizardSettings,
  usedBudget: number,
  receiptIndex: number,
  sessionDate: string,
): WizardReceipt | null {
  const remaining = settings.daily_limit_uzs - usedBudget
  const effectiveMax = Math.min(settings.max_receipt_uzs, remaining)
  if (effectiveMax < settings.min_receipt_uzs) return null

  const available = items.filter(
    (i) => i.remaining_packs > 0 && i.official_price_uzs > 0 && i.official_price_uzs <= effectiveMax,
  )
  if (available.length === 0) return null

  // Pick 1–4 random items
  const count = Math.min(Math.floor(Math.random() * 4) + 1, available.length)
  const shuffled = [...available].sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, count)

  const lines: { item: WizardItem; qty: number }[] = selected.map((item) => ({ item, qty: 1 }))
  let total = lines.reduce((s, l) => s + l.item.official_price_uzs, 0)

  // If already over max, keep only cheapest item with qty 1
  if (total > effectiveMax) {
    const cheapest = [...lines].sort((a, b) => a.item.official_price_uzs - b.item.official_price_uzs)[0]
    lines.length = 0
    lines.push(cheapest)
    total = cheapest.item.official_price_uzs
    if (total > effectiveMax) return null
  }

  // Increase quantities to approach min receipt size
  let iters = 0
  while (total < settings.min_receipt_uzs && iters < 3000) {
    iters++
    const idx = Math.floor(Math.random() * lines.length)
    const line = lines[idx]
    if (
      total + line.item.official_price_uzs <= effectiveMax &&
      line.qty < line.item.remaining_packs
    ) {
      line.qty++
      total += line.item.official_price_uzs
    }
  }

  // Fallback: sweep through each line linearly to hit min
  if (total < settings.min_receipt_uzs) {
    for (const line of lines) {
      while (
        total < settings.min_receipt_uzs &&
        line.qty < line.item.remaining_packs &&
        total + line.item.official_price_uzs <= effectiveMax
      ) {
        line.qty++
        total += line.item.official_price_uzs
      }
      if (total >= settings.min_receipt_uzs) break
    }
  }

  const receiptLines: ReceiptLine[] = lines.map((l) => ({
    item: l.item,
    qty: l.qty,
    line_total_uzs: l.qty * l.item.official_price_uzs,
  }))

  return {
    lines: receiptLines,
    total_uzs: receiptLines.reduce((s, l) => s + l.line_total_uzs, 0),
    receipt_number: receiptNumber(sessionDate, receiptIndex),
  }
}

export function useCashRegisterWizard() {
  const [items, setItems] = useState<WizardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [settings, setSettingsState] = useState<WizardSettings>(loadSettings)
  const [currentReceipt, setCurrentReceipt] = useState<WizardReceipt | null>(null)
  const [sessionReceipts, setSessionReceipts] = useState<WizardReceipt[]>([])
  const [confirming, setConfirming] = useState(false)
  const [closingSession, setClosingSession] = useState(false)
  const [sessionDate] = useState(todayStr)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const [itemsRes, regRes] = await Promise.all([
      supabase
        .from('delivery_items')
        .select(`
          id, product_id, official_price_uzs, sellable_qty,
          product:products(id, name, variety),
          delivery:deliveries(id, invoice_number)
        `)
        .not('official_price_uzs', 'is', null)
        .gt('sellable_qty', 0),
      supabase
        .from('cash_register')
        .select('delivery_item_id, packs_registered'),
    ])

    const regMap = new Map<string, number>()
    for (const r of regRes.data ?? []) {
      regMap.set(r.delivery_item_id, (regMap.get(r.delivery_item_id) ?? 0) + r.packs_registered)
    }

    const wizardItems: WizardItem[] = ((itemsRes.data ?? []) as {
      id: string
      official_price_uzs: number
      sellable_qty: number
      product: { name: string; variety: string | null } | { name: string; variety: string | null }[] | null
      delivery: { invoice_number: string | null } | { invoice_number: string | null }[] | null
    }[]).map((row) => {
      const product = Array.isArray(row.product) ? row.product[0] : row.product
      const delivery = Array.isArray(row.delivery) ? row.delivery[0] : row.delivery
      const registered = regMap.get(row.id) ?? 0
      const sellable = row.sellable_qty ?? 0
      return {
        delivery_item_id: row.id,
        product_name: product?.name ?? 'Unknown',
        variety: product?.variety ?? null,
        invoice_number: delivery?.invoice_number ?? null,
        official_price_uzs: row.official_price_uzs,
        sellable_qty: sellable,
        registered_packs: registered,
        remaining_packs: Math.max(0, sellable - registered),
      }
    })

    setItems(wizardItems)
    setLoading(false)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const sessionTotal = sessionReceipts.reduce((s, r) => s + r.total_uzs, 0)
  const remainingBudget = settings.daily_limit_uzs - sessionTotal

  // Overlay session-confirmed packs on top of fetched remaining_packs
  const liveItems: WizardItem[] = items.map((item) => {
    const confirmedPacks = sessionReceipts
      .flatMap((r) => r.lines)
      .filter((l) => l.item.delivery_item_id === item.delivery_item_id)
      .reduce((s, l) => s + l.qty, 0)
    return { ...item, remaining_packs: Math.max(0, item.remaining_packs - confirmedPacks) }
  })

  const generateReceipt = () => {
    const receipt = buildReceipt(
      liveItems,
      settings,
      sessionTotal,
      sessionReceipts.length + 1,
      sessionDate,
    )
    if (!receipt) {
      toast('warning', 'Cannot generate receipt', 'No available inventory or daily budget exhausted')
      return
    }
    setCurrentReceipt(receipt)
  }

  const confirmReceipt = async (): Promise<boolean> => {
    if (!currentReceipt) return false
    setConfirming(true)
    const today = todayStr()
    const inserts: CashRegisterInsert[] = currentReceipt.lines.map((line) => ({
      delivery_item_id: line.item.delivery_item_id,
      register_date: today,
      packs_registered: line.qty,
      amount_uzs: line.line_total_uzs,
      receipt_number: currentReceipt.receipt_number,
    }))
    const { error } = await supabase.from('cash_register').insert(inserts)
    setConfirming(false)
    if (error) {
      toast('error', 'Failed to save receipt', error.message)
      return false
    }
    setSessionReceipts((prev) => [...prev, currentReceipt])
    setCurrentReceipt(null)
    await fetchItems()
    return true
  }

  const regenerateReceipt = () => {
    setCurrentReceipt(null)
    const receipt = buildReceipt(
      liveItems,
      settings,
      sessionTotal,
      sessionReceipts.length + 1,
      sessionDate,
    )
    if (!receipt) {
      toast('warning', 'Cannot generate receipt', 'No available inventory or daily budget exhausted')
      return
    }
    setCurrentReceipt(receipt)
  }

  const closeSession = async (): Promise<boolean> => {
    if (sessionReceipts.length === 0) {
      toast('warning', 'Empty session', 'No receipts to save')
      return false
    }
    setClosingSession(true)
    const entry: InkassoInsert = {
      inkasso_date: sessionDate,
      total_amount_uzs: sessionTotal,
      notes: `Wizard session ${sessionDate}: ${sessionReceipts.length} receipt(s)`,
    }
    const { error } = await supabase.from('inkasso').insert(entry)
    setClosingSession(false)
    if (error) {
      toast('error', 'Failed to close session', error.message)
      return false
    }
    toast('success', 'Session closed', `${sessionReceipts.length} receipts · ${sessionTotal.toLocaleString()} UZS → Inkasso`)
    setSessionReceipts([])
    setCurrentReceipt(null)
    return true
  }

  const updateSettings = (updates: Partial<WizardSettings>) => {
    const next = { ...settings, ...updates }
    setSettingsState(next)
    saveSettings(next)
  }

  return {
    items: liveItems,
    loading,
    settings,
    updateSettings,
    currentReceipt,
    sessionReceipts,
    sessionTotal,
    remainingBudget,
    sessionDate,
    confirming,
    closingSession,
    generateReceipt,
    confirmReceipt,
    regenerateReceipt,
    closeSession,
    refetch: fetchItems,
  }
}
