import type { Delivery, DeliveryItem, DeliveryCost, Opex, Sale } from '../types/database'

// ─── Landed Cost ──────────────────────────────────────────────────────────────

export interface LandedCostResult {
  item_id: string
  landed_cost_per_pack: number
  item_share: number
  allocated_costs: number
}

export function calcLandedCost(
  delivery: Delivery,
  items: DeliveryItem[],
  costs: DeliveryCost[]
): LandedCostResult[] {
  const totalDeliveryCostsUsd = costs.reduce((sum, c) => sum + c.amount_usd, 0)
  const totalCipUsd = delivery.total_cip_usd ?? items.reduce((sum, i) => sum + i.total_cip_usd, 0)

  return items.map((item) => {
    const itemShare = totalCipUsd > 0 ? item.total_cip_usd / totalCipUsd : 0
    const allocatedCosts = totalDeliveryCostsUsd * itemShare
    const landedCostPerPack =
      item.quantity > 0
        ? item.cip_price_usd + allocatedCosts / item.quantity
        : item.cip_price_usd

    return {
      item_id: item.id,
      landed_cost_per_pack: landedCostPerPack,
      item_share: itemShare,
      allocated_costs: allocatedCosts,
    }
  })
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

export interface PricingResult {
  recommended_price: number
  exceeds_map: boolean
}

export function calcRecommendedPrice(
  landedCostPerPack: number,
  marginPct: number,
  mapPrice: number | null
): PricingResult {
  const recommended_price = landedCostPerPack * (1 + marginPct / 100)
  const exceeds_map = mapPrice !== null && recommended_price > mapPrice
  return { recommended_price, exceeds_map }
}

// ─── Sellable Quantity ────────────────────────────────────────────────────────

export function calcSellableQty(quantity: number, testPacksQty: number): number {
  return Math.max(0, quantity - testPacksQty)
}

// ─── OpEx Allocation ──────────────────────────────────────────────────────────

export interface OpexAllocationResult {
  delivery_id: string
  allocated_amount_usd: number
  allocation_pct: number
}

export function calcOpexAllocation(
  monthOpexItems: Opex[],
  activeDeliveries: Delivery[]
): OpexAllocationResult[] {
  const totalOpexUsd = monthOpexItems.reduce((sum, o) => {
    const amountUsd = o.amount_usd ?? (o.amount_uzs && o.exchange_rate ? o.amount_uzs / o.exchange_rate : 0)
    return sum + amountUsd
  }, 0)

  const totalCip = activeDeliveries.reduce((sum, d) => sum + (d.total_cip_usd ?? 0), 0)

  return activeDeliveries.map((d) => {
    const deliveryCip = d.total_cip_usd ?? 0
    const allocationPct = totalCip > 0 ? deliveryCip / totalCip : 0
    return {
      delivery_id: d.id,
      allocated_amount_usd: totalOpexUsd * allocationPct,
      allocation_pct: allocationPct * 100,
    }
  })
}

// ─── P&L per Delivery ────────────────────────────────────────────────────────

export interface DeliveryPnL {
  revenue: number
  cogs: number
  gross_profit: number
  allocated_opex: number
  net_profit: number
  gross_margin_pct: number
  net_margin_pct: number
}

export function calcDeliveryPnL(
  items: DeliveryItem[],
  sales: Sale[],
  allocatedOpexUsd: number
): DeliveryPnL {
  // Map item id to landed cost
  const landedCostMap = new Map<string, number>(
    items.map((i) => [i.id, i.landed_cost_usd ?? 0])
  )

  let revenue = 0
  let cogs = 0

  for (const sale of sales) {
    revenue += sale.total_real_usd ?? sale.quantity * sale.real_price_per_pack
    const landedCost = landedCostMap.get(sale.delivery_item_id) ?? 0
    cogs += landedCost * sale.quantity
  }

  const gross_profit = revenue - cogs
  const net_profit = gross_profit - allocatedOpexUsd
  const gross_margin_pct = revenue > 0 ? (gross_profit / revenue) * 100 : 0
  const net_margin_pct = revenue > 0 ? (net_profit / revenue) * 100 : 0

  return { revenue, cogs, gross_profit, allocated_opex: allocatedOpexUsd, net_profit, gross_margin_pct, net_margin_pct }
}

// ─── Inkasso ──────────────────────────────────────────────────────────────────

export interface InkassoCalc {
  registered_amount_uzs: number
  deposited_to_bank_uzs: number
  difference_uzs: number
}

export function calcInkasso(
  cashReceivedUzs: number,
  quantity: number,
  officialPricePerPackUzs: number
): InkassoCalc {
  const registered_amount_uzs = quantity * officialPricePerPackUzs
  const deposited_to_bank_uzs = registered_amount_uzs
  const difference_uzs = cashReceivedUzs - registered_amount_uzs
  return { registered_amount_uzs, deposited_to_bank_uzs, difference_uzs }
}
