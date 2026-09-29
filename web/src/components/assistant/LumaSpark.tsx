interface LumaSparkProps {
  size?: number
  animated?: boolean
  className?: string
}

export function LumaSpark({ size = 28, animated, className }: LumaSparkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 30 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`${animated ? 'animate-spark' : ''} ${className ?? ''}`}
    >
      <rect x="0.5" y="0.5" width="29" height="29" rx="4" fill="#35415C" />
      <path d="M15 8L16.6 13.4L22 15L16.6 16.6L15 22L13.4 16.6L8 15L13.4 13.4L15 8Z" fill="#F6F1E7" />
    </svg>
  )
}
