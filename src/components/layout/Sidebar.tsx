import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  Package,
  Users,
  Truck,
  ShoppingCart,
  Banknote,
  Calculator,
  BarChart3,
  Tag,
} from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'

interface NavItem {
  href: string
  label: string
  icon: ReactNode
}

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { href: '/suppliers', label: 'Suppliers', icon: <Building2 size={18} /> },
  { href: '/products', label: 'Products', icon: <Package size={18} /> },
  { href: '/dealers', label: 'Dealers', icon: <Users size={18} /> },
  { href: '/deliveries', label: 'Deliveries', icon: <Truck size={18} /> },
  { href: '/sales', label: 'Sales', icon: <ShoppingCart size={18} /> },
  { href: '/inkasso', label: 'Inkasso', icon: <Banknote size={18} /> },
  { href: '/opex', label: 'OpEx', icon: <Calculator size={18} /> },
  { href: '/pnl', label: 'P&L', icon: <BarChart3 size={18} /> },
  { href: '/pricing', label: 'Pricing', icon: <Tag size={18} /> },
]

export function Sidebar() {
  const { sidebarCollapsed } = useUIStore()

  return (
    <aside
      className={[
        'flex flex-col bg-white border-r border-gray-200 shrink-0 h-screen sticky top-0',
        'transition-all duration-200 ease-in-out',
        sidebarCollapsed ? 'w-16' : 'w-60',
      ].join(' ')}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="shrink-0 h-7 w-7 rounded-md bg-[#1a56db] flex items-center justify-center">
            <Package size={14} className="text-white" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-semibold text-gray-900 whitespace-nowrap">SeedFlow</span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/'}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors mb-0.5',
                isActive
                  ? 'bg-blue-50 text-[#1a56db]'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                sidebarCollapsed ? 'justify-center' : '',
              ].join(' ')
            }
            title={sidebarCollapsed ? item.label : undefined}
          >
            <span className="shrink-0">{item.icon}</span>
            {!sidebarCollapsed && (
              <span className="truncate">{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
