import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center border border-border-soft text-rust">
        <Compass size={24} />
      </div>
      <h1 className="font-display text-2xl italic text-ink">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-soft">The page you're looking for doesn't exist or has moved.</p>
      <Link to="/" className="mt-6">
        <Button>Back to Dashboard</Button>
      </Link>
    </div>
  )
}
