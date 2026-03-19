import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  title: string
  message?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  children?: ReactNode
}

export function Modal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  danger = false,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  children,
}: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      <div className="relative z-10 w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {danger && (
              <div className="shrink-0 rounded-full bg-red-100 p-1.5">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
            )}
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={onCancel}
            className="ml-4 rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5">
          {message && <p className="text-sm text-gray-600">{message}</p>}
          {children}
        </div>
        <div className="flex justify-end gap-3 px-5 pb-5">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
