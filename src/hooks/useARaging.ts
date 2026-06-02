import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { PaymentTerms } from '../types/database'

export interface AgingSale {
  id: string
  dealer_id: string
  dealer_name: string
  sale_date: string
  payment_due_date: string | null
  payment_terms: PaymentTerms
  payment_status: string
  amount_usd: number
  days_outstanding: number
  invoice_ref: string | null
  product_name: string | null
}

export interface DealerAgingRow {
  dealer_id: string
  dealer_name: string
  current: number      // not yet due
  days_1_30: number
  days_31_60: number
  days_61_90: number
  days_90_plus: number
  total: number
  oldest_days: number
  sale_count: number
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export function useARaging() {
  const [sales, setSales] = useState<AgingSale[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('sales')
      .select(`
        id, dealer_id, sale_date, payment_due_date, payment_terms,
        payment_status, quantity, real_price_per_pack, total_real_usd,
        dealer:dealers(id, name),
        delivery_item:delivery_items(
          delivery:deliveries(invoice_number),
          product:products(name)
        )
      `)
      .in('payment_status', ['pending', 'partial'])
      .order('payment_due_date', { ascending: true })

    if (!error) {
      const today = todayStr()
      const rows: AgingSale[] = (data ?? []).map((r) => {
        const dealer = Array.isArray(r.dealer) ? r.dealer[0] : r.dealer
        const di = Array.isArray(r.delivery_item) ? r.delivery_item[0] : r.delivery_item
        const delivery = di ? (Array.isArray((di as Record<string, unknown>).delivery) ? ((di as Record<string, unknown>).delivery as {invoice_number:string|null}[])[0] : (di as Record<string, unknown>).delivery) : null
        const product = di ? (Array.isArray((di as Record<string, unknown>).product) ? ((di as Record<string, unknown>).product as {name:string}[])[0] : (di as Record<string, unknown>).product) : null
        const amount = r.total_real_usd ?? r.quantity * r.real_price_per_pack
        const due = r.payment_due_date
        const daysOutstanding = due
          ? Math.floor((new Date(today).getTime() - new Date(due).getTime()) / 86_400_000)
          : Math.floor((new Date(today).getTime() - new Date(r.sale_date).getTime()) / 86_400_000)
        return {
          id: r.id,
          dealer_id: r.dealer_id,
          dealer_name: (dealer as {name:string} | null)?.name ?? '—',
          sale_date: r.sale_date,
          payment_due_date: r.payment_due_date,
          payment_terms: r.payment_terms,
          payment_status: r.payment_status,
          amount_usd: amount,
          days_outstanding: daysOutstanding,
          invoice_ref: (delivery as {invoice_number:string|null} | null)?.invoice_number ?? null,
          product_name: (product as {name:string} | null)?.name ?? null,
        }
      })
      setSales(rows)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const dealerRows: DealerAgingRow[] = useMemo(() => {
    const map = new Map<string, DealerAgingRow>()
    for (const s of sales) {
      if (!map.has(s.dealer_id)) {
        map.set(s.dealer_id, {
          dealer_id: s.dealer_id,
          dealer_name: s.dealer_name,
          current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, days_90_plus: 0,
          total: 0, oldest_days: 0, sale_count: 0,
        })
      }
      const row = map.get(s.dealer_id)!
      row.sale_count++
      row.total += s.amount_usd
      row.oldest_days = Math.max(row.oldest_days, s.days_outstanding)
      const d = s.days_outstanding
      if (d <= 0) row.current += s.amount_usd
      else if (d <= 30) row.days_1_30 += s.amount_usd
      else if (d <= 60) row.days_31_60 += s.amount_usd
      else if (d <= 90) row.days_61_90 += s.amount_usd
      else row.days_90_plus += s.amount_usd
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [sales])

  const totals = useMemo(() => dealerRows.reduce(
    (acc, r) => ({
      current: acc.current + r.current,
      days_1_30: acc.days_1_30 + r.days_1_30,
      days_31_60: acc.days_31_60 + r.days_31_60,
      days_61_90: acc.days_61_90 + r.days_61_90,
      days_90_plus: acc.days_90_plus + r.days_90_plus,
      total: acc.total + r.total,
    }),
    { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, days_90_plus: 0, total: 0 },
  ), [dealerRows])

  return { sales, dealerRows, totals, loading, refetch: fetch }
}
