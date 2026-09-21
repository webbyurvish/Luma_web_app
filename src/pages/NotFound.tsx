import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-warning-soft text-gold-dark">
        <Compass size={28} />
      </div>
      <h1 className="text-2xl font-bold text-ink">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-soft">The page you're looking for doesn't exist or has moved.</p>
      <Link to="/" className="mt-6">
        <Button>Back to Dashboard</Button>
      </Link>
    </div>
  )
}
