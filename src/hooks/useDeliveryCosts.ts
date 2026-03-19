import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { DeliveryCost, DeliveryCostInsert, DeliveryCostUpdate } from '../types/database'
import { toast } from '../components/ui/Toast'

export function useDeliveryCosts(deliveryId: string | undefined) {
  const [costs, setCosts] = useState<DeliveryCost[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!deliveryId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('delivery_costs')
      .select('id, delivery_id, cost_type, description, amount, currency, amount_usd, document_ref, created_at')
      .eq('delivery_id', deliveryId)
      .order('created_at')
    if (error) {
      toast('error', 'Failed to load costs', error.message)
    } else {
      setCosts(data ?? [])
    }
    setLoading(false)
  }, [deliveryId])

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: DeliveryCostInsert): Promise<boolean> => {
    const { error } = await supabase.from('delivery_costs').insert(values)
    if (error) { toast('error', 'Failed to add cost', error.message); return false }
    toast('success', 'Cost added')
    await fetch()
    return true
  }

  const update = async (id: string, values: DeliveryCostUpdate): Promise<boolean> => {
    const { error } = await supabase.from('delivery_costs').update(values).eq('id', id)
    if (error) { toast('error', 'Failed to update cost', error.message); return false }
    toast('success', 'Cost updated')
    await fetch()
    return true
  }

  const remove = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('delivery_costs').delete().eq('id', id)
    if (error) { toast('error', 'Failed to delete cost', error.message); return false }
    toast('success', 'Cost deleted')
    await fetch()
    return true
  }

  return { costs, loading, refetch: fetch, create, update, remove }
}
