import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

interface LumaSparkProps {
  size?: number
  animated?: boolean
  className?: string
}

export function LumaSpark({ size = 32, animated, className }: LumaSparkProps) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn(animated && 'animate-spark', className)}
    >
      <defs>
        <linearGradient id="luma-spark-gradient" x1="3" y1="3" x2="37" y2="37" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F4B83F" />
          <stop offset="0.5" stopColor="#DF5B9C" />
          <stop offset="1" stopColor="#7759E8" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="13" fill="url(#luma-spark-gradient)" />
      <path d="M20 10.5L22.1 17.9L29.5 20L22.1 22.1L20 29.5L17.9 22.1L10.5 20L17.9 17.9L20 10.5Z" fill="#FFFFFF" />
    </motion.svg>
  )
}
