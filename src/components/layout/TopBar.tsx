import { useEffect } from 'react'
import { Menu, LogOut, DollarSign } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'
import { useExchangeRateStore } from '../../stores/exchangeRateStore'
import { formatNumber } from '../../lib/formatters'

export function TopBar() {
  const { toggleSidebar } = useUIStore()
  const { user, signOut } = useAuthStore()
  const { currentRate, fetchCurrentRate } = useExchangeRateStore()

  useEffect(() => {
    fetchCurrentRate()
  }, [fetchCurrentRate])

  return (
    <header className="flex items-center justify-between h-14 px-4 bg-white border-b border-gray-200 shrink-0 sticky top-0 z-30">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="rounded-md p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Center — exchange rate */}
      <div className="flex items-center gap-2">
        {currentRate != null && (
          <div className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            <DollarSign size={12} className="text-gray-500" />
            1 USD = {formatNumber(currentRate, 0)} UZS
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {user && (
          <span className="hidden sm:block text-sm text-gray-600 truncate max-w-[180px]">
            {user.email}
          </span>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          title="Sign out"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  )
}
