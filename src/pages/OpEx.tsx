import { Breadcrumb } from '../components/ui/Breadcrumb'

export function OpEx() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumb items={[{ label: 'OpEx' }]} />
        <h1 className="mt-2 text-xl font-semibold text-gray-900">Operating Expenses</h1>
      </div>
      <div className="rounded-lg bg-white border border-gray-200 p-8 text-center text-gray-400 text-sm">
        Monthly OpEx grid coming soon.
      </div>
    </div>
  )
}
