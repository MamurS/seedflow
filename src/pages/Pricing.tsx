import { useEffect, useState, useMemo } from 'react'
import { FileText, AlertTriangle } from 'lucide-react'
import { usePricing, type PricingItem } from '../hooks/usePricing'
import { supabase } from '../lib/supabase'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { Badge } from '../components/ui/Badge'
import { formatUSD, formatDate, formatPct } from '../lib/formatters'
import { COST_TYPES } from '../lib/constants'

// ─── Cost Justification Narrative ─────────────────────────────────────────────

const COST_NARRATIVES: Record<string, string> = {
  vat: 'Import VAT is applied to all agricultural seed imports per Uzbekistan customs regulations (Tax Code Article 246).',
  customs_duty: 'Customs duty is levied on the CIP value of the imported goods per the Customs Tariff Schedule.',
  akd: 'Anti-dumping duty (AKD) is mandated by the State Customs Committee for seeds originating from designated countries.',
  ikt: 'Infrastructure tax (IKT) is collected at the border for road infrastructure usage during goods transit.',
  airfreight: 'Air freight was required due to seasonal planting calendar constraints, ensuring timely delivery before the sowing window.',
  warehouse_storage: 'Warehouse and cold storage fees were incurred during customs clearance to maintain seed viability.',
  broker_commission: 'Customs broker commission covers declaration, HS code classification, and documentation services required for seed import.',
  broker_delivery: 'Broker delivery charges cover inland transport from the customs terminal to the warehouse.',
  quarantine_test: 'Phytosanitary quarantine testing is mandatory for all seed imports under Uzbekistan Plant Quarantine Law No. 311.',
  agroinspection_test: 'Agroinspection certification is required for all commercial seed lots under Ministry of Agriculture Order No. 84.',
  test_packs: 'Test packs are allocated free of charge for pre-sale quality demonstrations, reducing the sellable quantity and increasing per-pack import costs.',
  qr_code: 'QR code labeling is required for Uzbekistan market regulatory compliance (Ministry of Agriculture Digital Traceability Program).',
  other: 'Additional costs were incurred during import processing and are documented with supporting receipts.',
}

// ─── HTML Generator ───────────────────────────────────────────────────────────

interface DeliveryCostRaw {
  id: string
  cost_type: string
  description: string | null
  amount: number
  currency: string
  amount_usd: number
  document_ref: string | null
}

function generateCostJustificationHtml(item: PricingItem, costs: DeliveryCostRaw[]): string {
  const productName = item.product?.name ?? 'Unknown Product'
  const supplierName = item.delivery?.supplier?.name ?? '—'
  const invoiceNumber = item.delivery?.invoice_number ?? '—'
  const invoiceDate = item.delivery?.invoice_date ? formatDate(item.delivery.invoice_date) : '—'
  const landedCost = item.landed_cost_usd ?? 0
  const recommendedPrice = item.recommended_price_usd ?? 0
  const mapPrice = item.product?.map_price ?? 0
  const mapCurrency = item.product?.map_currency ?? 'USD'
  const overMapDiff = recommendedPrice - mapPrice
  const overMapPct = mapPrice > 0 ? (overMapDiff / mapPrice) * 100 : 0
  const perPackCosts = landedCost - item.cip_price_usd

  const costRows = costs
    .map((c) => {
      const costLabel = COST_TYPES.find((t) => t.value === c.cost_type)?.label ?? c.cost_type
      return `<tr>
        <td>${costLabel}${c.description ? ` — ${c.description}` : ''}</td>
        <td>${c.document_ref ?? '—'}</td>
        <td style="text-align:right">${c.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${c.currency}</td>
        <td style="text-align:right">$${c.amount_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      </tr>`
    })
    .join('')

  const presentCostTypes = new Set(costs.map((c) => c.cost_type))
  const narrativeItems = [...presentCostTypes]
    .filter((ct) => COST_NARRATIVES[ct])
    .map((ct) => `<p>${COST_NARRATIVES[ct]}</p>`)
    .join('')

  const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cost Justification — ${productName}</title>
  <style>
    * { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
    body { padding: 48px; color: #111; font-size: 14px; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 26px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
    .product-name { font-size: 20px; color: #c0392b; font-weight: 600; margin-bottom: 6px; }
    .subtitle { font-size: 13px; color: #777; margin-bottom: 36px; }
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #555; margin: 28px 0 10px; border-bottom: 2px solid #eee; padding-bottom: 6px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 8px; }
    .info-box { background: #f7f8fa; border: 1px solid #eee; border-radius: 6px; padding: 12px 16px; }
    .info-box .label { font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; }
    .info-box .value { font-weight: 700; font-size: 15px; margin-top: 4px; color: #1a1a2e; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px; }
    thead th { background: #f0f0f0; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; }
    tbody td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; }
    tfoot td { padding: 10px 12px; background: #f7f8fa; font-weight: 700; border-top: 2px solid #ddd; }
    .comparison-box { background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
    .comparison-box .over-map { color: #c0392b; font-size: 16px; font-weight: 700; margin-bottom: 12px; }
    .comparison-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .comparison-item .label { font-size: 11px; text-transform: uppercase; color: #888; }
    .comparison-item .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
    .narrative { line-height: 1.8; color: #333; }
    .narrative p { margin-bottom: 12px; padding-left: 12px; border-left: 3px solid #ddd; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #ddd; color: #999; font-size: 12px; display: flex; justify-content: space-between; align-items: center; }
    .print-btn { display: inline-block; background: #1a73e8; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; cursor: pointer; margin-bottom: 24px; }
    .print-btn:hover { background: #1557b0; }
    @media print {
      .print-btn { display: none; }
      body { padding: 0; }
      @page { margin: 15mm 20mm; }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">&#11015; Download PDF / Print</button>

  <h1>Cost Justification</h1>
  <div class="product-name">${productName}</div>
  <p class="subtitle">This document justifies a recommended selling price exceeding the Manufacturer's Authorized Price (MAP) based on actual import and regulatory compliance costs.</p>

  <p class="section-title">Delivery Information</p>
  <div class="info-grid">
    <div class="info-box"><div class="label">Supplier</div><div class="value">${supplierName}</div></div>
    <div class="info-box"><div class="label">Invoice #</div><div class="value">${invoiceNumber}</div></div>
    <div class="info-box"><div class="label">Invoice Date</div><div class="value">${invoiceDate}</div></div>
    <div class="info-box"><div class="label">Quantity (packs)</div><div class="value">${item.quantity.toLocaleString('en-US')}</div></div>
  </div>

  <p class="section-title">Import Cost Breakdown</p>
  <table>
    <thead>
      <tr>
        <th>Cost Item</th>
        <th>Reference</th>
        <th style="text-align:right">Amount (Original)</th>
        <th style="text-align:right">Amount (USD)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>CIP Price (${item.quantity.toLocaleString('en-US')} packs × $${item.cip_price_usd.toFixed(2)})</td>
        <td>${invoiceNumber}</td>
        <td style="text-align:right">—</td>
        <td style="text-align:right">$${item.total_cip_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      </tr>
      ${costRows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3">Total Landed Cost (all ${item.quantity.toLocaleString('en-US')} packs)</td>
        <td style="text-align:right">$${(landedCost * item.quantity).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      </tr>
    </tfoot>
  </table>

  <p class="section-title">Per-Pack Pricing Calculation</p>
  <table>
    <thead>
      <tr>
        <th>Component</th>
        <th style="text-align:right">Per Pack (USD)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>CIP Price per Pack</td>
        <td style="text-align:right">$${item.cip_price_usd.toFixed(2)}</td>
      </tr>
      <tr>
        <td>Allocated Import Costs per Pack</td>
        <td style="text-align:right">$${perPackCosts.toFixed(2)}</td>
      </tr>
      <tr>
        <td><strong>Landed Cost per Pack</strong></td>
        <td style="text-align:right"><strong>$${landedCost.toFixed(2)}</strong></td>
      </tr>
      <tr>
        <td>Profit Margin (${item.margin_pct}%)</td>
        <td style="text-align:right">$${(recommendedPrice - landedCost).toFixed(2)}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td>Recommended Selling Price per Pack</td>
        <td style="text-align:right">$${recommendedPrice.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>

  <p class="section-title">MAP Comparison</p>
  <div class="comparison-box">
    <div class="over-map">&#9888; Recommended price exceeds MAP by $${overMapDiff.toFixed(2)} (${overMapPct.toFixed(1)}% above MAP)</div>
    <div class="comparison-grid">
      <div class="comparison-item">
        <div class="label">Recommended Price</div>
        <div class="value" style="color:#c0392b">$${recommendedPrice.toFixed(2)}</div>
      </div>
      <div class="comparison-item">
        <div class="label">MAP Price (${mapCurrency})</div>
        <div class="value" style="color:#555">${mapCurrency === 'USD' ? '$' : ''}${mapPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${mapCurrency}</div>
      </div>
      <div class="comparison-item">
        <div class="label">Above MAP</div>
        <div class="value" style="color:#c0392b">+$${overMapDiff.toFixed(2)} (+${overMapPct.toFixed(1)}%)</div>
      </div>
    </div>
  </div>

  <p class="section-title">Justification Narrative</p>
  <div class="narrative">
    <p>The recommended retail price of <strong>$${recommendedPrice.toFixed(2)} per pack</strong> for <strong>${productName}</strong> exceeds the supplier's MAP of <strong>${mapCurrency === 'USD' ? '$' : ''}${mapPrice.toFixed(2)} ${mapCurrency}</strong> due to mandatory country-specific import costs that are unavoidable under Uzbekistan law and cannot be waived or negotiated with the supplier.</p>
    ${narrativeItems}
    <p>All costs listed above are supported by official documents (customs declarations, tax receipts, laboratory test certificates) and are available for inspection upon request. The stated prices reflect actual costs incurred and are not subject to supplier MAP enforcement in the Uzbekistan market given these regulatory requirements.</p>
  </div>

  <div class="footer">
    <span>Generated: ${now}</span>
    <span>SeedFlow — Seed Import &amp; Distribution Management</span>
  </div>
</body>
</html>`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'over_map' | 'no_landed'

export function Pricing() {
  const { items, loading } = usePricing()
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [generating, setGenerating] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Pricing | SeedFlow'
    return () => { document.title = 'SeedFlow' }
  }, [])

  const filtered = useMemo(() => {
    if (filterMode === 'over_map') {
      return items.filter((item) => {
        const rec = item.recommended_price_usd
        const map = item.product?.map_price
        return rec != null && map != null && rec > map
      })
    }
    if (filterMode === 'no_landed') {
      return items.filter((item) => item.landed_cost_usd == null)
    }
    return items
  }, [items, filterMode])

  const overMapCount = useMemo(
    () => items.filter((item) => {
      const rec = item.recommended_price_usd
      const map = item.product?.map_price
      return rec != null && map != null && rec > map
    }).length,
    [items],
  )

  const handleGenerateJustification = async (item: PricingItem) => {
    setGenerating(item.id)
    const { data: costs } = await supabase
      .from('delivery_costs')
      .select('id, cost_type, description, amount, currency, amount_usd, document_ref')
      .eq('delivery_id', item.delivery_id)
    setGenerating(null)

    const html = generateCostJustificationHtml(item, (costs ?? []) as DeliveryCostRaw[])
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
    }
  }

  const exceedsMap = (item: PricingItem) => {
    const rec = item.recommended_price_usd
    const map = item.product?.map_price
    return rec != null && map != null && rec > map
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Breadcrumb items={[{ label: 'Pricing' }]} />
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Pricing</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Landed cost, margin, and MAP comparison per delivery item.
          </p>
        </div>
        {overMapCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2">
            <AlertTriangle size={16} className="text-red-500 shrink-0" />
            <span className="text-sm text-red-700 font-medium">
              {overMapCount} item{overMapCount !== 1 ? 's' : ''} exceed MAP
            </span>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 self-start">
        {([
          ['all', 'All Items'],
          ['over_map', `Over MAP (${overMapCount})`],
          ['no_landed', 'Missing Landed Cost'],
        ] as [FilterMode, string][]).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilterMode(value)}
            className={[
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              filterMode === value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            {filterMode === 'over_map'
              ? 'No items exceed MAP. '
              : filterMode === 'no_landed'
              ? 'All items have landed cost calculated.'
              : 'No delivery items found.'}
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {[
                  'Product', 'Invoice #', 'Supplier', 'Qty',
                  'CIP/Pack', 'Landed/Pack', 'Margin', 'Rec. Price', 'MAP', 'Status', '',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((item) => {
                const over = exceedsMap(item)
                const map = item.product?.map_price
                const mapCurrency = item.product?.map_currency ?? 'USD'
                return (
                  <tr key={item.id} className={over ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {item.product?.name ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {item.delivery?.invoice_number ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {item.delivery?.supplier?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.quantity.toLocaleString('en-US')}</td>
                    <td className="px-4 py-3 text-gray-900">{formatUSD(item.cip_price_usd)}</td>
                    <td className="px-4 py-3 text-gray-900">
                      {item.landed_cost_usd != null ? (
                        formatUSD(item.landed_cost_usd)
                      ) : (
                        <span className="text-yellow-600 text-xs font-medium">Not calculated</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatPct(item.margin_pct)}</td>
                    <td className={`px-4 py-3 font-semibold ${over ? 'text-red-600' : 'text-green-700'}`}>
                      {item.recommended_price_usd != null ? formatUSD(item.recommended_price_usd) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {map != null ? (
                        <span>{mapCurrency === 'USD' ? '$' : ''}{map.toFixed(2)} {mapCurrency !== 'USD' ? mapCurrency : ''}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {item.recommended_price_usd == null ? (
                        <Badge variant="neutral" label="No price" />
                      ) : map == null ? (
                        <Badge variant="neutral" label="No MAP" />
                      ) : over ? (
                        <Badge variant="danger" label="Over MAP" />
                      ) : (
                        <Badge variant="success" label="OK" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {over && (
                        <button
                          onClick={() => handleGenerateJustification(item)}
                          disabled={generating === item.id}
                          className="flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                          title="Generate Cost Justification document"
                        >
                          {generating === item.id ? (
                            <span className="h-3 w-3 animate-spin rounded-full border border-red-400 border-t-transparent" />
                          ) : (
                            <FileText size={12} />
                          )}
                          Justify
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className="text-xs text-gray-400">
          Showing {filtered.length} item{filtered.length !== 1 ? 's' : ''}.
          {overMapCount > 0 && ' Items highlighted in red exceed the supplier MAP price.'}
        </p>
      )}
    </div>
  )
}
