import { AlertCircle } from 'lucide-react'
import { Button } from './Button'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Please try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-border bg-card px-6 py-12 text-center shadow-card">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertCircle size={24} />
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-xs text-xs text-ink-soft">{description}</p>
      {onRetry && (
        <Button className="mt-5" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
