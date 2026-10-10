// components/Toast.tsx
import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info'

interface ToastData {
  id: string
  type: ToastType
  message: string
}

let _setToasts: ((fn: (prev: ToastData[]) => ToastData[]) => void) | null = null

export function showToast(message: string, type: ToastType = 'info') {
  if (_setToasts) {
    const id = Date.now().toString()
    _setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => {
      _setToasts?.(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([])
  _setToasts = setToasts

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-20 md:bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full"
      role="status"
      aria-live="polite"
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 p-3 rounded-lg shadow-lg text-sm
            ${toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : ''}
            ${toast.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : ''}
            ${toast.type === 'info' ? 'bg-blue-50 text-blue-800 border border-blue-200' : ''}
          `}
        >
          {toast.type === 'success' && <CheckCircle size={16} className="mt-0.5 shrink-0" />}
          {toast.type === 'error' && <XCircle size={16} className="mt-0.5 shrink-0" />}
          {toast.type === 'info' && <Info size={16} className="mt-0.5 shrink-0" />}
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => remove(toast.id)}
            className="shrink-0 opacity-60 hover:opacity-100 min-w-[20px] min-h-[20px]"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
