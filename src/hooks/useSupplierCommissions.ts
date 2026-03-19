import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { SupplierCommission, SupplierCommissionInsert, SupplierCommissionUpdate } from '../types/database'
import { toast } from '../components/ui/Toast'

export function useSupplierCommissions(deliveryId?: string) {
  const [commissions, setCommissions] = useState<SupplierCommission[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('supplier_commissions')
      .select('id, delivery_id, commission_type, amount_usd, description, paid, paid_date, created_at')
      .order('created_at')

    if (deliveryId) {
      query = query.eq('delivery_id', deliveryId)
    }

    const { data, error } = await query
    if (error) {
      toast('error', 'Failed to load commissions', error.message)
    } else {
      setCommissions((data ?? []) as SupplierCommission[])
    }
    setLoading(false)
  }, [deliveryId])

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: SupplierCommissionInsert): Promise<boolean> => {
    const { error } = await supabase.from('supplier_commissions').insert(values)
    if (error) { toast('error', 'Failed to add commission', error.message); return false }
    toast('success', 'Commission added')
    await fetch()
    return true
  }

  const update = async (id: string, values: SupplierCommissionUpdate): Promise<boolean> => {
    const { error } = await supabase.from('supplier_commissions').update(values).eq('id', id)
    if (error) { toast('error', 'Failed to update commission', error.message); return false }
    toast('success', 'Commission updated')
    await fetch()
    return true
  }

  const remove = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('supplier_commissions').delete().eq('id', id)
    if (error) { toast('error', 'Failed to delete commission', error.message); return false }
    toast('success', 'Commission deleted')
    await fetch()
    return true
  }

  const totalUsd = commissions.reduce((s, c) => s + c.amount_usd, 0)

  return { commissions, loading, refetch: fetch, create, update, remove, totalUsd }
}

// Hook for all commissions (used in P&L)
export function useAllSupplierCommissions() {
  const [commissionsByDelivery, setCommissionsByDelivery] = useState<Map<string, SupplierCommission[]>>(new Map())
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('supplier_commissions')
      .select('id, delivery_id, commission_type, amount_usd, description, paid, paid_date, created_at')

    if (error) {
      toast('error', 'Failed to load commissions', error.message)
    } else {
      const map = new Map<string, SupplierCommission[]>()
      for (const c of data ?? []) {
        const list = map.get(c.delivery_id) ?? []
        list.push(c as SupplierCommission)
        map.set(c.delivery_id, list)
      }
      setCommissionsByDelivery(map)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { commissionsByDelivery, loading, refetch: fetch }
}
