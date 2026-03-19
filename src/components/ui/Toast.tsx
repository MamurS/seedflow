import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: string
  variant: ToastVariant
  title: string
  message?: string
}

const icons: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle size={18} className="text-green-600 shrink-0" />,
  error: <XCircle size={18} className="text-red-600 shrink-0" />,
  warning: <AlertTriangle size={18} className="text-yellow-600 shrink-0" />,
  info: <Info size={18} className="text-blue-600 shrink-0" />,
}

const borderColors: Record<ToastVariant, string> = {
  success: 'border-l-4 border-green-500',
  error: 'border-l-4 border-red-500',
  warning: 'border-l-4 border-yellow-500',
  info: 'border-l-4 border-blue-500',
}

// Simple global toast store
let _addToast: ((variant: ToastVariant, title: string, message?: string) => void) | null = null

export function toast(variant: ToastVariant, title: string, message?: string) {
  _addToast?.(variant, title, message)
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((variant: ToastVariant, title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, variant, title, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  useEffect(() => {
    _addToast = addToast
    return () => { _addToast = null }
  }, [addToast])

  const remove = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))

  if (toasts.length === 0) return null

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            'flex items-start gap-3 rounded-lg bg-white shadow-lg p-4',
            borderColors[t.variant],
          ].join(' ')}
        >
          {icons[t.variant]}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{t.title}</p>
            {t.message && <p className="text-xs text-gray-500 mt-0.5">{t.message}</p>}
          </div>
          <button
            onClick={() => remove(t.id)}
            className="shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body
  )
}
