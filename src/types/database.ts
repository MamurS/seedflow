// ─── Enum / Union Types ───────────────────────────────────────────────────────

export type DeliveryStatus =
  | 'ordered'
  | 'invoiced'
  | 'paid'
  | 'in_transit'
  | 'customs'
  | 'cleared'
  | 'delivered'

export type CostType =
  | 'vat'
  | 'customs_duty'
  | 'akd'
  | 'ikt'
  | 'airfreight'
  | 'warehouse_storage'
  | 'broker_commission'
  | 'broker_delivery'
  | 'quarantine_test'
  | 'agroinspection_test'
  | 'test_packs'
  | 'qr_code'
  | 'other'

export type OpexCategory =
  | 'rent'
  | 'accounting'
  | 'cash_register'
  | 'salary'
  | 'payroll_tax'
  | 'income_tax'
  | 'bank_fees'
  | 'other'

export type PaymentTerms = 'prepayment' | 'deferred_30' | 'deferred_60' | 'deferred_90'

export type PaymentStatus = 'pending' | 'partial' | 'paid'

export type Currency = 'UZS' | 'USD'

// ─── Table Interfaces ─────────────────────────────────────────────────────────

export interface Supplier {
  id: string
  name: string
  country: string
  contact_person: string | null
  email: string | null
  phone: string | null
  payment_terms: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SupplierInsert {
  name: string
  country: string
  contact_person?: string | null
  email?: string | null
  phone?: string | null
  payment_terms?: string | null
  notes?: string | null
}

export interface SupplierUpdate extends Partial<SupplierInsert> {}

export interface Product {
  id: string
  supplier_id: string
  name: string
  crop_type: string
  variety: string | null
  unit: string
  seeds_per_pack: number | null
  map_price: number | null
  map_currency: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // joined
  supplier?: Supplier
}

export interface ProductInsert {
  supplier_id: string
  name: string
  crop_type: string
  variety?: string | null
  unit?: string
  seeds_per_pack?: number | null
  map_price?: number | null
  map_currency?: string | null
  notes?: string | null
  is_active?: boolean
}

export interface ProductUpdate extends Partial<ProductInsert> {}

export interface Dealer {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  region: string | null
  payment_terms: PaymentTerms | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DealerInsert {
  name: string
  contact_person?: string | null
  phone?: string | null
  email?: string | null
  region?: string | null
  payment_terms?: PaymentTerms | null
  notes?: string | null
}

export interface DealerUpdate extends Partial<DealerInsert> {}

export interface Delivery {
  id: string
  supplier_id: string
  invoice_number: string | null
  invoice_date: string | null
  order_date: string | null
  payment_date: string | null
  ship_date: string | null
  customs_start_date: string | null
  customs_clear_date: string | null
  delivery_date: string | null
  status: DeliveryStatus
  total_cip_usd: number | null
  airfreight_usd: number
  exchange_rate: number | null
  cycle_start_month: string | null
  cycle_end_month: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // joined
  supplier?: Supplier
}

export interface DeliveryInsert {
  supplier_id: string
  invoice_number?: string | null
  invoice_date?: string | null
  order_date?: string | null
  payment_date?: string | null
  ship_date?: string | null
  customs_start_date?: string | null
  customs_clear_date?: string | null
  delivery_date?: string | null
  status?: DeliveryStatus
  total_cip_usd?: number | null
  airfreight_usd?: number
  exchange_rate?: number | null
  cycle_start_month?: string | null
  cycle_end_month?: string | null
  notes?: string | null
}

export interface DeliveryUpdate extends Partial<DeliveryInsert> {}

export interface DeliveryItem {
  id: string
  delivery_id: string
  product_id: string
  quantity: number
  cip_price_usd: number
  // GENERATED column — never INSERT/UPDATE directly
  total_cip_usd: number
  landed_cost_usd: number | null
  recommended_price_usd: number | null
  margin_pct: number
  official_price_uzs: number | null
  test_packs_qty: number
  sellable_qty: number | null
  notes: string | null
  created_at: string
  // joined
  product?: Product
  delivery?: Delivery
}

export interface DeliveryItemInsert {
  delivery_id: string
  product_id: string
  quantity: number
  cip_price_usd: number
  // Do NOT include total_cip_usd — it's GENERATED
  landed_cost_usd?: number | null
  recommended_price_usd?: number | null
  margin_pct?: number
  official_price_uzs?: number | null
  test_packs_qty?: number
  sellable_qty?: number | null
  notes?: string | null
}

export interface DeliveryItemUpdate {
  quantity?: number
  cip_price_usd?: number
  // Do NOT include total_cip_usd — it's GENERATED
  landed_cost_usd?: number | null
  recommended_price_usd?: number | null
  margin_pct?: number
  official_price_uzs?: number | null
  test_packs_qty?: number
  sellable_qty?: number | null
  notes?: string | null
}

export interface DeliveryCost {
  id: string
  delivery_id: string
  cost_type: CostType
  description: string | null
  amount: number
  currency: Currency
  amount_usd: number
  document_ref: string | null
  created_at: string
}

export interface DeliveryCostInsert {
  delivery_id: string
  cost_type: CostType
  description?: string | null
  amount: number
  currency: Currency
  amount_usd: number
  document_ref?: string | null
}

export interface DeliveryCostUpdate extends Partial<Omit<DeliveryCostInsert, 'delivery_id'>> {}

export interface Opex {
  id: string
  month: string
  category: OpexCategory
  description: string | null
  amount_uzs: number | null
  amount_usd: number | null
  exchange_rate: number | null
  created_at: string
}

export interface OpexInsert {
  month: string
  category: OpexCategory
  description?: string | null
  amount_uzs?: number | null
  amount_usd?: number | null
  exchange_rate?: number | null
}

export interface OpexUpdate extends Partial<OpexInsert> {}

export interface OpexAllocation {
  id: string
  opex_id: string
  delivery_id: string
  month: string
  allocated_amount_usd: number
  allocation_pct: number
  created_at: string
  // joined
  opex?: Opex
  delivery?: Delivery
}

export interface OpexAllocationInsert {
  opex_id: string
  delivery_id: string
  month: string
  allocated_amount_usd: number
  allocation_pct: number
}

export interface Sale {
  id: string
  dealer_id: string
  delivery_item_id: string
  sale_date: string
  quantity: number
  real_price_per_pack: number
  official_price_per_pack_uzs: number | null
  total_real_usd: number | null
  total_official_uzs: number | null
  payment_terms: PaymentTerms
  payment_due_date: string | null
  payment_status: PaymentStatus
  payment_received_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // joined
  dealer?: Dealer
  delivery_item?: DeliveryItem
}

export interface SaleInsert {
  dealer_id: string
  delivery_item_id: string
  sale_date: string
  quantity: number
  real_price_per_pack: number
  official_price_per_pack_uzs?: number | null
  total_real_usd?: number | null
  total_official_uzs?: number | null
  payment_terms: PaymentTerms
  payment_due_date?: string | null
  payment_status?: PaymentStatus
  payment_received_date?: string | null
  notes?: string | null
}

export interface SaleUpdate extends Partial<Omit<SaleInsert, 'dealer_id' | 'delivery_item_id'>> {}

export interface Inkasso {
  id: string
  inkasso_date: string
  total_amount_uzs: number
  notes: string | null
  created_at: string
}

export interface InkassoInsert {
  inkasso_date: string
  total_amount_uzs: number
  notes?: string | null
}

export interface InkassoUpdate extends Partial<InkassoInsert> {}

// ─── Cash Register ────────────────────────────────────────────────────────────

export interface CashRegister {
  id: string
  delivery_item_id: string
  register_date: string
  packs_registered: number
  amount_uzs: number
  receipt_number: string | null
  notes: string | null
  created_at: string
  // joined
  delivery_item?: DeliveryItem
}

export interface CashRegisterInsert {
  delivery_item_id: string
  register_date: string
  packs_registered: number
  amount_uzs: number
  receipt_number?: string | null
  notes?: string | null
}

export interface CashRegisterUpdate extends Partial<Omit<CashRegisterInsert, 'delivery_item_id'>> {}

// ─── Supplier Commissions ────────────────────────────────────────────────────

export type CommissionType = 'supplier' | 'manager'

export interface SupplierCommission {
  id: string
  delivery_id: string
  commission_type: CommissionType
  amount_usd: number
  description: string | null
  paid: boolean
  paid_date: string | null
  created_at: string
}

export interface SupplierCommissionInsert {
  delivery_id: string
  commission_type: CommissionType
  amount_usd: number
  description?: string | null
  paid?: boolean
  paid_date?: string | null
}

export interface SupplierCommissionUpdate extends Partial<Omit<SupplierCommissionInsert, 'delivery_id'>> {}

export interface ExchangeRate {
  id: string
  date: string
  usd_uzs: number
  source: string
  created_at: string
}

export interface ExchangeRateInsert {
  date: string
  usd_uzs: number
  source?: string
}
