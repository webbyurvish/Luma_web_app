import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Keeps one broken page (e.g. an unexpected value in a sheet row) from blanking the whole app:
 * the sidebar stays usable and the page shows a way out. Remounted per route by its parent.
 */
export class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Luma] Page crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto mt-10 max-w-md rounded-hero border border-border bg-card px-6 py-8 text-center shadow-card">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-warning-soft text-warning">
          <AlertTriangle size={20} />
        </span>
        <h2 className="mt-4 font-display text-xl italic text-ink">This page hit a snag</h2>
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
          Something in your data didn't look the way this page expected. The rest of Luma still works — use the menu, or reload to try again.
        </p>
        <p className="mt-3 rounded-btn bg-bg-soft px-3 py-2 font-mono-figure text-[10.5px] text-ink-muted">{this.state.error.message}</p>
        <Button className="mt-5" size="sm" icon={<RotateCcw size={13} />} onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    )
  }
}
