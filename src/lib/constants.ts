import type { DeliveryStatus, CostType, OpexCategory, PaymentTerms, PaymentStatus } from '../types/database'

export const DELIVERY_STATUSES: { value: DeliveryStatus; label: string }[] = [
  { value: 'ordered', label: 'Ordered' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'paid', label: 'Paid' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'customs', label: 'In Customs' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'delivered', label: 'Delivered' },
]

export const DELIVERY_STATUS_COLORS: Record<DeliveryStatus, string> = {
  ordered: 'bg-gray-100 text-gray-700',
  invoiced: 'bg-blue-100 text-blue-700',
  paid: 'bg-indigo-100 text-indigo-700',
  in_transit: 'bg-yellow-100 text-yellow-700',
  customs: 'bg-orange-100 text-orange-700',
  cleared: 'bg-teal-100 text-teal-700',
  delivered: 'bg-green-100 text-green-700',
}

export const COST_TYPES: { value: CostType; label: string }[] = [
  { value: 'vat', label: 'VAT' },
  { value: 'customs_duty', label: 'Customs Duty' },
  { value: 'akd', label: 'AKD' },
  { value: 'ikt', label: 'IKT' },
  { value: 'airfreight', label: 'Airfreight' },
  { value: 'warehouse_storage', label: 'Warehouse Storage' },
  { value: 'broker_commission', label: 'Broker Commission' },
  { value: 'broker_delivery', label: 'Broker Delivery' },
  { value: 'quarantine_test', label: 'Quarantine Test' },
  { value: 'agroinspection_test', label: 'Agroinspection Test' },
  { value: 'test_packs', label: 'Test Packs' },
  { value: 'qr_code', label: 'QR Code' },
  { value: 'other', label: 'Other' },
]

export const OPEX_CATEGORIES: { value: OpexCategory; label: string }[] = [
  { value: 'rent', label: 'Rent' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'cash_register', label: 'Cash Register' },
  { value: 'salary', label: 'Salary' },
  { value: 'payroll_tax', label: 'Payroll Tax' },
  { value: 'income_tax', label: 'Income Tax' },
  { value: 'bank_fees', label: 'Bank Fees' },
  { value: 'other', label: 'Other' },
]

export const PAYMENT_TERMS: { value: PaymentTerms; label: string }[] = [
  { value: 'prepayment', label: 'Prepayment' },
  { value: 'deferred_30', label: 'Net 30' },
  { value: 'deferred_60', label: 'Net 60' },
  { value: 'deferred_90', label: 'Net 90' },
]

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  partial: 'bg-orange-100 text-orange-700',
  paid: 'bg-green-100 text-green-700',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pending',
  partial: 'Partial',
  paid: 'Paid',
}

export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  prepayment: 'Prepayment',
  deferred_30: 'Net 30',
  deferred_60: 'Net 60',
  deferred_90: 'Net 90',
}
