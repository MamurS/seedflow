import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Opex, OpexInsert, OpexAllocation, OpexAllocationInsert, OpexCategory, Delivery } from '../types/database'
import { toast } from '../components/ui/Toast'

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function currentYM(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOpEx() {
  const [entries, setEntries] = useState<Opex[]>([])
  const [allocations, setAllocations] = useState<OpexAllocation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from('opex')
      .select('id, month, category, description, amount_uzs, amount_usd, exchange_rate, created_at')
      .order('month')
      .order('category')
    if (error) toast('error', 'Failed to load OpEx', error.message)
    else setEntries(data ?? [])
  }, [])

  const fetchAllocations = useCallback(async () => {
    const { data, error } = await supabase
      .from('opex_allocation')
      .select(`
        id, opex_id, delivery_id, month, allocated_amount_usd, allocation_pct, created_at,
        delivery:deliveries(id, invoice_number, total_cip_usd, supplier:suppliers(name))
      `)
      .order('month')
      .order('delivery_id')
    if (!error) {
      const normalized = (data ?? []).map((r) => ({
        ...r,
        delivery: Array.isArray(r.delivery)
          ? r.delivery[0] ?? null
          : r.delivery,
      }))
      setAllocations(normalized as unknown as OpexAllocation[])
    }
  }, [])

  const refetch = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchEntries(), fetchAllocations()])
    setLoading(false)
  }, [fetchEntries, fetchAllocations])

  useEffect(() => { refetch() }, [refetch])

  // ── Upsert a single cell ───────────────────────────────────────────────────
  const upsertEntry = async (
    month: string,
    category: OpexCategory,
    amountUzs: number | null,
    exchangeRate: number | null,
  ) => {
    const existing = entries.find((e) => e.month === month && e.category === category)
    const amountUsd =
      amountUzs != null && exchangeRate != null && exchangeRate > 0
        ? amountUzs / exchangeRate
        : null

    if (existing) {
      // Optimistic update
      setEntries((prev) =>
        prev.map((e) =>
          e.id === existing.id
            ? { ...e, amount_uzs: amountUzs, exchange_rate: exchangeRate, amount_usd: amountUsd }
            : e,
        ),
      )
      const { error } = await supabase
        .from('opex')
        .update({ amount_uzs: amountUzs, exchange_rate: exchangeRate, amount_usd: amountUsd })
        .eq('id', existing.id)
      if (error) {
        toast('error', 'Failed to update', error.message)
        await fetchEntries()
      }
    } else if (amountUzs != null && amountUzs !== 0) {
      const { data, error } = await supabase
        .from('opex')
        .insert({
          month,
          category,
          amount_uzs: amountUzs,
          exchange_rate: exchangeRate,
          amount_usd: amountUsd,
        } as OpexInsert)
        .select()
        .single()
      if (!error && data) setEntries((prev) => [...prev, data])
      else if (error) toast('error', 'Failed to create entry', error.message)
    }
  }

  // ── Update exchange rate for all entries of a month ────────────────────────
  const setMonthExchangeRate = async (month: string, rate: number) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.month !== month) return e
        const amountUsd = e.amount_uzs != null && rate > 0 ? e.amount_uzs / rate : null
        return { ...e, exchange_rate: rate, amount_usd: amountUsd }
      }),
    )
    const monthEntries = entries.filter((e) => e.month === month)
    if (monthEntries.length === 0) return
    const { error } = await supabase
      .from('opex')
      .update({ exchange_rate: rate })
      .eq('month', month)
    if (error) {
      toast('error', 'Failed to update exchange rate', error.message)
      await fetchEntries()
    }
  }

  // ── Copy previous month's entries to target month ──────────────────────────
  const copyPreviousMonth = async (targetMonth: string) => {
    const prevMonth = addMonths(targetMonth, -1)
    const prevEntries = entries.filter((e) => e.month === prevMonth)
    const existingCats = new Set(
      entries.filter((e) => e.month === targetMonth).map((e) => e.category),
    )
    const toInsert = prevEntries
      .filter((e) => !existingCats.has(e.category) && e.amount_uzs != null)
      .map(
        (e) =>
          ({
            month: targetMonth,
            category: e.category,
            amount_uzs: e.amount_uzs,
            exchange_rate: e.exchange_rate,
            amount_usd: e.amount_usd,
          }) as OpexInsert,
      )

    if (toInsert.length === 0) {
      toast('info', 'Nothing new to copy from previous month')
      return
    }
    const { data, error } = await supabase.from('opex').insert(toInsert).select()
    if (error) toast('error', 'Failed to copy entries', error.message)
    else {
      setEntries((prev) => [...prev, ...(data ?? [])])
      toast('success', `Copied ${toInsert.length} entries from ${monthLabel(prevMonth)}`)
    }
  }

  // ── Recalculate OpEx allocations for all months that have entries ──────────
  const recalculateAllocations = async (deliveries: Delivery[]) => {
    const months = [...new Set(entries.map((e) => e.month))].sort()
    if (months.length === 0) {
      toast('info', 'No OpEx entries to allocate')
      return
    }

    const toInsert: OpexAllocationInsert[] = []

    for (const month of months) {
      const monthEntries = entries.filter((e) => e.month === month)
      const active = deliveries.filter((d) => {
        const s = d.cycle_start_month?.slice(0, 7) ?? null
        const e = d.cycle_end_month?.slice(0, 7) ?? null
        if (s && e) return s <= month && month <= e
        if (s) return s <= month
        return (d.total_cip_usd ?? 0) > 0
      })
      if (active.length === 0) continue

      const totalCip = active.reduce((sum, d) => sum + (d.total_cip_usd ?? 0), 0)

      for (const entry of monthEntries) {
        const entryUsd = entry.amount_usd ?? 0
        if (entryUsd === 0) continue
        for (const delivery of active) {
          const pct = totalCip > 0 ? (delivery.total_cip_usd ?? 0) / totalCip : 0
          toInsert.push({
            opex_id: entry.id,
            delivery_id: delivery.id,
            month,
            allocated_amount_usd: entryUsd * pct,
            allocation_pct: pct * 100,
          })
        }
      }
    }

    // Delete existing allocations for all those months
    for (const month of months) {
      await supabase.from('opex_allocation').delete().eq('month', month)
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from('opex_allocation').insert(toInsert)
      if (error) toast('error', 'Failed to save allocations', error.message)
      else {
        toast('success', `Saved ${toInsert.length} allocation records across ${months.length} months`)
        await fetchAllocations()
      }
    } else {
      toast('info', 'No allocations calculated — check exchange rates and delivery CIP values')
    }
  }

  return {
    entries,
    allocations,
    loading,
    refetch,
    upsertEntry,
    setMonthExchangeRate,
    copyPreviousMonth,
    recalculateAllocations,
  }
}
