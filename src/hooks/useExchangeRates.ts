import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { ExchangeRate, ExchangeRateInsert } from '../types/database'
import { toast } from '../components/ui/Toast'

export function useExchangeRates() {
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('id, date, usd_uzs, source, created_at')
      .order('date', { ascending: false })
      .range(0, 99)
    if (error) {
      toast('error', 'Failed to load exchange rates', error.message)
    } else {
      setRates(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: ExchangeRateInsert): Promise<boolean> => {
    const { error } = await supabase.from('exchange_rates').insert(values)
    if (error) { toast('error', 'Failed to add rate', error.message); return false }
    toast('success', 'Exchange rate added')
    await fetch()
    return true
  }

  const remove = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('exchange_rates').delete().eq('id', id)
    if (error) { toast('error', 'Failed to delete rate', error.message); return false }
    toast('success', 'Rate deleted')
    await fetch()
    return true
  }

  return { rates, loading, refetch: fetch, create, remove }
}
