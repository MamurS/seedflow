import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface CardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  trend?: { value: number; label?: string }
  className?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

const variantBorder: Record<string, string> = {
  default: 'border-gray-200',
  success: 'border-green-200',
  warning: 'border-yellow-200',
  danger: 'border-red-200',
}

export function Card({ title, value, subtitle, icon, trend, className = '', variant = 'default' }: CardProps) {
  return (
    <div
      className={[
        'rounded-lg bg-white border p-5 shadow-sm',
        variantBorder[variant],
        className,
      ].join(' ')}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 font-medium truncate">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 truncate">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
          {trend && (
            <div
              className={[
                'mt-2 inline-flex items-center gap-1 text-xs font-medium',
                trend.value >= 0 ? 'text-green-600' : 'text-red-600',
              ].join(' ')}
            >
              {trend.value >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(trend.value).toFixed(1)}%{trend.label ? ` ${trend.label}` : ''}
            </div>
          )}
        </div>
        {icon && (
          <div className="ml-4 shrink-0 rounded-lg bg-blue-50 p-2.5 text-[#1a56db]">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
