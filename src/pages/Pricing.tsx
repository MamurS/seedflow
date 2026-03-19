import { Breadcrumb } from '../components/ui/Breadcrumb'

export function Pricing() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumb items={[{ label: 'Pricing' }]} />
        <h1 className="mt-2 text-xl font-semibold text-gray-900">Pricing</h1>
      </div>
      <div className="rounded-lg bg-white border border-gray-200 p-8 text-center text-gray-400 text-sm">
        Pricing table with landed cost, margin, and MAP comparison coming soon.
      </div>
    </div>
  )
}
