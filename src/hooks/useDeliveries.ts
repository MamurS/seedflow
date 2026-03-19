import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Delivery, DeliveryInsert, DeliveryUpdate } from '../types/database'
import { toast } from '../components/ui/Toast'

export function useDeliveries() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('deliveries')
      .select(`
        id, supplier_id, invoice_number, invoice_date, order_date, payment_date,
        ship_date, customs_start_date, customs_clear_date, delivery_date,
        status, total_cip_usd, airfreight_usd, exchange_rate,
        cycle_start_month, cycle_end_month, notes, created_at, updated_at,
        supplier:suppliers(id, name, country)
      `)
      .order('created_at', { ascending: false })
    if (error) {
      toast('error', 'Failed to load deliveries', error.message)
    } else {
      const normalized = (data ?? []).map((row) => ({
        ...row,
        supplier: Array.isArray(row.supplier) ? row.supplier[0] ?? null : row.supplier,
      }))
      setDeliveries(normalized as unknown as Delivery[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: DeliveryInsert): Promise<string | null> => {
    const { data, error } = await supabase
      .from('deliveries')
      .insert(values)
      .select('id')
      .single()
    if (error) { toast('error', 'Failed to create delivery', error.message); return null }
    toast('success', 'Delivery created')
    await fetch()
    return data.id
  }

  const update = async (id: string, values: DeliveryUpdate): Promise<boolean> => {
    const { error } = await supabase.from('deliveries').update(values).eq('id', id)
    if (error) { toast('error', 'Failed to update delivery', error.message); return false }
    toast('success', 'Delivery updated')
    await fetch()
    return true
  }

  const remove = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('deliveries').delete().eq('id', id)
    if (error) { toast('error', 'Failed to delete delivery', error.message); return false }
    toast('success', 'Delivery deleted')
    await fetch()
    return true
  }

  return { deliveries, loading, refetch: fetch, create, update, remove }
}

export function useDelivery(id: string | undefined) {
  const [delivery, setDelivery] = useState<Delivery | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('deliveries')
      .select(`
        id, supplier_id, invoice_number, invoice_date, order_date, payment_date,
        ship_date, customs_start_date, customs_clear_date, delivery_date,
        status, total_cip_usd, airfreight_usd, exchange_rate,
        cycle_start_month, cycle_end_month, notes, created_at, updated_at,
        supplier:suppliers(id, name, country)
      `)
      .eq('id', id)
      .single()
    if (error) {
      toast('error', 'Failed to load delivery', error.message)
    } else if (data) {
      const normalized = {
        ...data,
        supplier: Array.isArray(data.supplier) ? data.supplier[0] ?? null : data.supplier,
      }
      setDelivery(normalized as unknown as Delivery)
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  const update = async (values: DeliveryUpdate): Promise<boolean> => {
    if (!id) return false
    const { error } = await supabase.from('deliveries').update(values).eq('id', id)
    if (error) { toast('error', 'Failed to update delivery', error.message); return false }
    await fetch()
    return true
  }

  return { delivery, loading, refetch: fetch, update }
}
