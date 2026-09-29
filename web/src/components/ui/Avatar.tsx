import { cn } from '@/lib/cn'

interface AvatarProps {
  name: string
  size?: number
  className?: string
  inverted?: boolean
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0].slice(0, 2)
  return initials.toUpperCase()
}

export function Avatar({ name, size = 36, className, inverted }: AvatarProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-display font-medium',
        inverted ? 'bg-rust text-[#F6F1E7]' : 'bg-ink-rail text-paper',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-label={name}
    >
      {getInitials(name)}
    </div>
  )
}
