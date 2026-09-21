import { createContext, type ReactNode, useCallback, useContext, useState } from 'react'
import { CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface ToastItem {
  id: string
  message: string
  variant: 'success' | 'info'
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastItem['variant']) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, variant: ToastItem['variant'] = 'success') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, 3200)
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex w-full max-w-sm flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'flex items-center gap-2.5 rounded-btn border border-border bg-card px-4 py-3 text-sm text-ink shadow-hover animate-fade-up',
            )}
          >
            {toast.variant === 'success' ? (
              <CheckCircle2 size={18} className="shrink-0 text-success" />
            ) : (
              <Info size={18} className="shrink-0 text-info" />
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 text-ink-muted hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider')
  return context
}
