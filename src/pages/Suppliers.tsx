import { Breadcrumb } from '../components/ui/Breadcrumb'
import { Button } from '../components/ui/Button'
import { Plus } from 'lucide-react'

export function Suppliers() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <Breadcrumb items={[{ label: 'Suppliers' }]} />
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Suppliers</h1>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={16} />}>
          Add Supplier
        </Button>
      </div>
      <div className="rounded-lg bg-white border border-gray-200 p-8 text-center text-gray-400 text-sm">
        Suppliers table coming soon.
      </div>
    </div>
  )
}
