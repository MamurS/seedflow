import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Inkasso, InkassoInsert, InkassoUpdate } from '../types/database'
import { toast } from '../components/ui/Toast'
import { calcInkasso } from '../lib/calculations'

function normalizeJoin<T>(val: unknown): T | null {
  if (val == null) return null
  if (Array.isArray(val)) return (val[0] ?? null) as T | null
  return val as T
}

export interface UnpaidSaleOption {
  id: string
  label: string
  sale_date: string
  quantity: number
  official_price_per_pack_uzs: number | null
  total_official_uzs: number | null
}

const INKASSO_SELECT = `
  id, sale_id, inkasso_date, cash_received,
  registered_amount_uzs, deposited_to_bank_uzs, difference_uzs,
  receipt_number, notes, created_at,
  sale:sales(
    id, sale_date, quantity, official_price_per_pack_uzs, total_official_uzs,
    dealer:dealers(id, name),
    delivery_item:delivery_items(
      product:products(id, name)
    )
  )
`

function normalizeInkasso(row: Record<string, unknown>): Inkasso {
  const sale = normalizeJoin<Record<string, unknown>>(row.sale)
  if (!sale) return row as unknown as Inkasso
  const di = normalizeJoin<Record<string, unknown>>(sale.delivery_item)
  return {
    ...row,
    sale: {
      ...sale,
      dealer: normalizeJoin(sale.dealer),
      delivery_item: di
        ? { ...di, product: normalizeJoin(di.product) }
        : null,
    },
  } as unknown as Inkasso
}

export function useInkasso() {
  const [inkassos, setInkassos] = useState<Inkasso[]>([])
  const [unpaidSales, setUnpaidSales] = useState<UnpaidSaleOption[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('inkasso')
      .select(INKASSO_SELECT)
      .order('inkasso_date', { ascending: false })

    if (error) {
      toast('error', 'Failed to load inkasso records', error.message)
    } else {
      setInkassos(
        (data ?? []).map((r) => normalizeInkasso(r as Record<string, unknown>))
      )
    }

    // Fetch unpaid/partial sales for the "Record Inkasso" dropdown
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select(`
        id, sale_date, quantity, official_price_per_pack_uzs, total_official_uzs,
        dealer:dealers(id, name),
        delivery_item:delivery_items(
          product:products(id, name)
        )
      `)
      .in('payment_status', ['pending', 'partial'])
      .order('sale_date', { ascending: false })

    if (!salesError) {
      const opts: UnpaidSaleOption[] = (salesData ?? []).map((s) => {
        const dealer = normalizeJoin<{ name: string }>(s.dealer)
        const di = normalizeJoin<Record<string, unknown>>(s.delivery_item)
        const product = di ? normalizeJoin<{ name: string }>(di.product) : null
        const dateStr = new Date(s.sale_date).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })
        return {
          id: s.id,
          label: `${dealer?.name ?? 'Dealer'} — ${product?.name ?? 'Product'} — ${dateStr}`,
          sale_date: s.sale_date,
          quantity: s.quantity,
          official_price_per_pack_uzs: s.official_price_per_pack_uzs,
          total_official_uzs: s.total_official_uzs,
        }
      })
      setUnpaidSales(opts)
    }

    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: InkassoInsert): Promise<boolean> => {
    const { error } = await supabase.from('inkasso').insert(values)
    if (error) { toast('error', 'Failed to record inkasso', error.message); return false }

    // Mark linked sale as paid
    const { error: saleErr } = await supabase
      .from('sales')
      .update({ payment_status: 'paid', payment_received_date: values.inkasso_date })
      .eq('id', values.sale_id)

    if (saleErr) {
      toast('warning', 'Inkasso recorded but failed to update sale status', saleErr.message)
    } else {
      toast('success', 'Inkasso recorded — sale marked as paid')
    }

    await fetch()
    return true
  }

  const update = async (id: string, values: InkassoUpdate): Promise<boolean> => {
    const { error } = await supabase.from('inkasso').update(values).eq('id', id)
    if (error) { toast('error', 'Failed to update inkasso', error.message); return false }
    toast('success', 'Inkasso updated')
    await fetch()
    return true
  }

  const remove = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('inkasso').delete().eq('id', id)
    if (error) { toast('error', 'Failed to delete inkasso', error.message); return false }
    toast('success', 'Inkasso deleted')
    await fetch()
    return true
  }

  return { inkassos, unpaidSales, loading, refetch: fetch, create, update, remove }
}

export { calcInkasso }
