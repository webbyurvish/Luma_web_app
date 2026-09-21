import { cn } from '@/lib/cn'

interface AvatarProps {
  name: string
  size?: number
  className?: string
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0].slice(0, 2)
  return initials.toUpperCase()
}

export function Avatar({ name, size = 36, className }: AvatarProps) {
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-gold-light to-gold font-semibold text-ink', className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-label={name}
    >
      {getInitials(name)}
    </div>
  )
}
