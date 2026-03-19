import { useParams } from 'react-router-dom'
import { Breadcrumb } from '../components/ui/Breadcrumb'

export function DeliveryDetail() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumb
          items={[
            { label: 'Deliveries', href: '/deliveries' },
            { label: 'Delivery Detail' },
          ]}
        />
        <h1 className="mt-2 text-xl font-semibold text-gray-900">Delivery Detail</h1>
        <p className="text-sm text-gray-500">ID: {id}</p>
      </div>
      <div className="rounded-lg bg-white border border-gray-200 p-8 text-center text-gray-400 text-sm">
        Delivery detail with tabs (Items, Costs, Landed Cost, Pricing, Timeline) coming soon.
      </div>
    </div>
  )
}
