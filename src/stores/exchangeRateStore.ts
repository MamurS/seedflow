import { create } from 'zustand'
import type { ExchangeRate } from '../types/database'
import { supabase } from '../lib/supabase'

interface ExchangeRateState {
  currentRate: number | null
  rates: ExchangeRate[]
  loading: boolean
  fetchCurrentRate: () => Promise<void>
  fetchRates: () => Promise<void>
}

export const useExchangeRateStore = create<ExchangeRateState>((set) => ({
  currentRate: null,
  rates: [],
  loading: false,

  fetchCurrentRate: async () => {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('usd_uzs, date')
      .order('date', { ascending: false })
      .limit(1)

    if (!error && data && data.length > 0) {
      set({ currentRate: data[0].usd_uzs })
    }
  },

  fetchRates: async () => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('id, date, usd_uzs, source, created_at')
      .order('date', { ascending: false })
      .range(0, 49)

    if (!error && data) {
      set({ rates: data, loading: false })
    } else {
      set({ loading: false })
    }
  },
}))
