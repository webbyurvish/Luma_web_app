import type { ReactNode } from 'react'
import { motion, type Variants } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { easeOut, easeSnappy } from '@/lib/motion'
import { cn } from '@/lib/cn'

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { ...easeOut, delay: Math.min(i, 6) * 0.05 } }),
  hover: { y: -3, boxShadow: 'var(--shadow-hover)', transition: easeSnappy },
}

interface KPICardProps {
  label: string
  value: string
  trend: number
  trendLabel?: string
  icon: ReactNode
  accent: 'success' | 'danger' | 'ai' | 'gold'
  sparkline: number[]
  index?: number
}

const accentStyles: Record<KPICardProps['accent'], { iconBg: string; iconText: string; line: string; surface: string; border: string }> = {
  success: { iconBg: 'bg-success-soft', iconText: 'text-success', line: 'var(--color-success)', surface: 'bg-card', border: 'border-border-soft' },
  danger: { iconBg: 'bg-danger-soft', iconText: 'text-danger', line: 'var(--color-danger)', surface: 'bg-card', border: 'border-border-soft' },
  ai: { iconBg: 'bg-white/60', iconText: 'text-ai', line: 'var(--color-ai)', surface: 'bg-gradient-lavender', border: 'border-transparent' },
  gold: { iconBg: 'bg-warning-soft', iconText: 'text-gold-dark', line: 'var(--color-gold-dark)', surface: 'bg-card', border: 'border-border-soft' },
}

export function KPICard({ label, value, trend, trendLabel = 'vs last month', icon, accent, sparkline, index = 0 }: KPICardProps) {
  const positive = trend >= 0
  const style = accentStyles[accent]
  const chartData = sparkline.map((v, i) => ({ i, v }))

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      className={cn('relative flex h-full flex-col justify-between overflow-hidden rounded-card border p-5 shadow-card', style.surface, style.border)}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-ink-soft">{label}</p>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-full', style.iconBg, style.iconText)}>{icon}</div>
      </div>

      <div className="mt-3.5 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-bold leading-none tracking-tight text-ink sm:text-[26px]">{value}</p>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs">
            <span className={cn('flex items-center gap-0.5 font-medium', positive ? 'text-success' : 'text-danger')}>
              {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {Math.abs(trend)}%
            </span>
            <span className="text-ink-muted">{trendLabel}</span>
          </div>
        </div>
        <div className="h-9 w-16 shrink-0 opacity-90">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <Line type="monotone" dataKey="v" stroke={style.line} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  )
}
