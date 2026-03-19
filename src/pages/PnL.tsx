import { Breadcrumb } from '../components/ui/Breadcrumb'

export function PnL() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumb items={[{ label: 'P&L' }]} />
        <h1 className="mt-2 text-xl font-semibold text-gray-900">Profit & Loss</h1>
      </div>
      <div className="rounded-lg bg-white border border-gray-200 p-8 text-center text-gray-400 text-sm">
        P&L per delivery table coming soon.
      </div>
    </div>
  )
}
