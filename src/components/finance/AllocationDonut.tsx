import { useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { PieProps } from 'recharts'
import { Card, CardHeader } from '@/components/ui/Card'
import { formatCurrency, formatPercentage } from '@/lib/formatCurrency'
import { cn } from '@/lib/cn'
import type { AllocationSlice } from '@/lib/financeCalculations'

interface DonutTooltipPayload {
  payload: AllocationSlice
}

function DonutTooltip({ active, payload, total }: { active?: boolean; payload?: DonutTooltipPayload[]; total: number }) {
  if (!active || !payload?.length) return null
  const entry = payload[0].payload
  const percentage = total > 0 ? (entry.value / total) * 100 : 0
  return (
    <div className="min-w-[128px] rounded-sm bg-ink-rail px-3 py-2 shadow-hover">
      <p className="text-[11px] font-medium text-paper">{entry.label}</p>
      <p className="mt-0.5 font-mono-figure text-sm font-bold text-paper">{formatCurrency(entry.value)}</p>
      <p className="text-[10px] text-paper/55">{formatPercentage(percentage)} of total</p>
    </div>
  )
}

interface AllocationDonutProps {
  title: string
  subtitle?: string
  data: AllocationSlice[]
  centerLabel: string
}

export function AllocationDonut({ title, subtitle, data, centerLabel }: AllocationDonutProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const activeEntry = hovered !== null ? data[hovered] : null

  const handleEnter: NonNullable<PieProps['onMouseEnter']> = (_, index) => setHovered(index)
  const handleLeave = () => setHovered(null)

  return (
    <Card hoverable className="h-full">
      <CardHeader title={title} subtitle={subtitle} />

      {data.length === 0 ? (
        <p className="py-8 text-center text-xs text-ink-muted">Not enough data yet.</p>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <div className="relative h-[168px] w-[168px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={56}
                  outerRadius={80}
                  paddingAngle={2.5}
                  cornerRadius={5}
                  stroke="none"
                  isAnimationActive
                  animationDuration={750}
                  animationEasing="ease-out"
                  onMouseEnter={handleEnter}
                  onMouseLeave={handleLeave}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={entry.key}
                      fill={entry.color}
                      opacity={hovered === null || hovered === index ? 1 : 0.35}
                      style={{ transition: 'opacity 150ms ease' }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="font-mono-figure text-lg font-bold text-ink">
                {formatCurrency(activeEntry ? activeEntry.value : total, { compact: true })}
              </p>
              <p className="text-[10px] uppercase tracking-[0.05em] text-ink-muted">{activeEntry ? activeEntry.label : centerLabel}</p>
            </div>
          </div>

          <ul className="w-full flex-1 space-y-1.5">
            {data.map((entry, index) => (
              <li
                key={entry.key}
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
                className={cn(
                  'flex items-center justify-between gap-3 px-1.5 py-1 text-xs transition-colors duration-150',
                  hovered === index && 'bg-bg-soft',
                )}
              >
                <span className="flex min-w-0 items-center gap-2 text-ink-soft">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className={cn('truncate', hovered === index && 'font-medium text-ink')}>{entry.label}</span>
                </span>
                <span className="shrink-0 font-mono-figure text-ink">{formatCurrency(entry.value, { compact: true })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
