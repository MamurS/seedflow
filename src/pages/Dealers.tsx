import { Breadcrumb } from '../components/ui/Breadcrumb'
import { Button } from '../components/ui/Button'
import { Plus } from 'lucide-react'

export function Dealers() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <Breadcrumb items={[{ label: 'Dealers' }]} />
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Dealers</h1>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={16} />}>
          Add Dealer
        </Button>
      </div>
      <div className="rounded-lg bg-white border border-gray-200 p-8 text-center text-gray-400 text-sm">
        Dealers table coming soon.
      </div>
    </div>
  )
}
