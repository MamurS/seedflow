import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { Sale, Delivery, DeliveryItem } from '../types/database'
import { toast } from '../components/ui/Toast'

function normalizeJoin<T>(val: unknown): T | null {
  if (val == null) return null
  if (Array.isArray(val)) return (val[0] ?? null) as T
  return val as T
}

export interface OverdueSale extends Omit<Sale, 'dealer' | 'delivery_item'> {
  daysOverdue: number
  dealer?: { name: string }
  delivery_item?: {
    landed_cost_usd: number | null
    product?: { name: string }
    delivery?: { invoice_number: string | null }
  }
}

export interface InventoryRow {
  item: DeliveryItem & {
    product?: { name: string }
    delivery?: { invoice_number: string | null }
  }
  sold: number
  remaining: number
  sellable: number
}

export interface PipelineStage {
  status: string
  label: string
  count: number
}

export interface DashboardKPIs {
  revenueYTD: number
  grossProfitYTD: number
  netProfitYTD: number
  outstanding: number
}

const PIPELINE_STAGES = [
  { status: 'ordered', label: 'Ordered' },
  { status: 'invoiced', label: 'Invoiced' },
  { status: 'paid', label: 'Paid' },
  { status: 'in_transit', label: 'In Transit' },
  { status: 'customs', label: 'In Customs' },
  { status: 'cleared', label: 'Cleared' },
  { status: 'delivered', label: 'Delivered' },
]

export function useDashboard() {
  const [sales, setSales] = useState<Sale[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [allItems, setAllItems] = useState<DeliveryItem[]>([])
  const [ytdAllocatedOpex, setYtdAllocatedOpex] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const currentYear = new Date().getFullYear()

    const [sr, dr, ir, ar] = await Promise.all([
      supabase
        .from('sales')
        .select(`
          id, dealer_id, delivery_item_id, sale_date, quantity,
          total_real_usd, real_price_per_pack, payment_status, payment_due_date,
          dealer:dealers(name),
          delivery_item:delivery_items(
            id, landed_cost_usd,
            product:products(name),
            delivery:deliveries(id, invoice_number)
          )
        `)
        .order('sale_date', { ascending: false }),
      supabase
        .from('deliveries')
        .select('id, invoice_number, status, total_cip_usd, supplier:suppliers(name), created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('delivery_items')
        .select(`
          id, delivery_id, sellable_qty,
          product:products(name),
          delivery:deliveries(invoice_number)
        `),
      supabase
        .from('opex_allocation')
        .select('delivery_id, month, allocated_amount_usd')
        .like('month', `${currentYear}-%`),
    ])

    if (sr.error) toast('error', 'Failed to load sales', sr.error.message)
    if (dr.error) toast('error', 'Failed to load deliveries', dr.error.message)

    const normalizedSales = (sr.data ?? []).map((r) => {
      const di = normalizeJoin<Record<string, unknown>>(r.delivery_item)
      return {
        ...r,
        dealer: normalizeJoin(r.dealer),
        delivery_item: di
          ? { ...di, product: normalizeJoin(di.product), delivery: normalizeJoin(di.delivery) }
          : null,
      }
    }) as unknown as Sale[]

    const normalizedDeliveries = (dr.data ?? []).map((d) => ({
      ...d,
      supplier: normalizeJoin(d.supplier),
    })) as unknown as Delivery[]

    const normalizedItems = (ir.data ?? []).map((i) => ({
      ...i,
      product: normalizeJoin(i.product),
      delivery: normalizeJoin(i.delivery),
    })) as unknown as DeliveryItem[]

    const opexTotal = (ar.data ?? []).reduce((s, a) => s + a.allocated_amount_usd, 0)

    setSales(normalizedSales)
    setDeliveries(normalizedDeliveries)
    setAllItems(normalizedItems)
    setYtdAllocatedOpex(opexTotal)
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const today = new Date().toISOString().split('T')[0]
  const currentYear = new Date().getFullYear()

  const kpis: DashboardKPIs = useMemo(() => {
    const ytdSales = sales.filter((s) => s.sale_date.startsWith(String(currentYear)))

    let revenue = 0
    let cogs = 0
    for (const s of ytdSales) {
      revenue += s.total_real_usd ?? s.quantity * s.real_price_per_pack
      const di = (s as unknown as { delivery_item?: { landed_cost_usd?: number | null } }).delivery_item
      cogs += (di?.landed_cost_usd ?? 0) * s.quantity
    }

    let outstanding = 0
    for (const s of sales) {
      if (s.payment_status !== 'paid') {
        outstanding += s.total_real_usd ?? s.quantity * s.real_price_per_pack
      }
    }

    return {
      revenueYTD: revenue,
      grossProfitYTD: revenue - cogs,
      netProfitYTD: revenue - cogs - ytdAllocatedOpex,
      outstanding,
    }
  }, [sales, ytdAllocatedOpex, currentYear])

  const pipeline: PipelineStage[] = useMemo(() => {
    const counts = new Map<string, number>()
    for (const d of deliveries) counts.set(d.status, (counts.get(d.status) ?? 0) + 1)
    return PIPELINE_STAGES.map(({ status, label }) => ({ status, label, count: counts.get(status) ?? 0 }))
  }, [deliveries])

  const overduePayments: OverdueSale[] = useMemo(() => {
    return sales
      .filter((s) => s.payment_status !== 'paid' && s.payment_due_date && s.payment_due_date < today)
      .map((s) => {
        const dueDate = new Date(s.payment_due_date!)
        const now = new Date(today)
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000)
        return { ...s, daysOverdue } as OverdueSale
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
  }, [sales, today])

  const inventorySummary: InventoryRow[] = useMemo(() => {
    const soldByItem = new Map<string, number>()
    for (const s of sales) {
      soldByItem.set(s.delivery_item_id, (soldByItem.get(s.delivery_item_id) ?? 0) + s.quantity)
    }
    return allItems
      .map((item) => {
        const sold = soldByItem.get(item.id) ?? 0
        const sellable = item.sellable_qty ?? 0
        return { item: item as InventoryRow['item'], sold, sellable, remaining: Math.max(0, sellable - sold) }
      })
      .filter((r) => r.sellable > 0)
      .sort((a, b) => a.remaining - b.remaining)
      .slice(0, 15)
  }, [allItems, sales])

  return { loading, kpis, pipeline, overduePayments, inventorySummary, deliveries, sales }
}
