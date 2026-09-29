import { motion } from 'framer-motion'
import { HandCoins, Landmark, PieChart, TrendingUp, type LucideIcon } from 'lucide-react'
import { LumaSpark } from './LumaSpark'
import { fadeUp } from '@/lib/motion'

const STARTERS: { icon: LucideIcon; title: string; prompt: string; tint: string }[] = [
  { icon: PieChart, title: 'Spending', prompt: 'How much did I spend this month vs last month?', tint: 'text-rust bg-rust-soft/70' },
  { icon: TrendingUp, title: 'Where it goes', prompt: 'Where is most of my money going?', tint: 'text-warning bg-warning-soft' },
  { icon: HandCoins, title: 'Udhaar', prompt: 'Who owes me money, and is anything overdue?', tint: 'text-ai bg-ai-soft' },
  { icon: Landmark, title: 'Net worth', prompt: 'What is my net worth made of?', tint: 'text-success bg-success-soft' },
]

function greeting() {
  const hour = new Date().getHours()
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

export function AssistantEmptyState({ onPrompt, disabled }: { onPrompt: (prompt: string) => void; disabled?: boolean }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center-safe px-2 py-8 text-center">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
        <LumaSpark size={44} animated />
      </motion.div>
      <h2 className="mt-5 font-display text-2xl italic text-ink">{greeting()}. What would you like to know?</h2>
      <p className="mt-2 max-w-md text-xs leading-relaxed text-ink-soft">
        Ask about your spending, accounts, investments, SIPs, udhaar or tasks — by typing or with the mic. Answers come only from your own data.
      </p>

      <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2">
        {STARTERS.map((starter, index) => {
          const Icon = starter.icon
          return (
            <motion.button
              key={starter.title}
              type="button"
              custom={index}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              whileHover={{ y: -2 }}
              disabled={disabled}
              onClick={() => onPrompt(starter.prompt)}
              className="flex items-start gap-3 rounded-card border border-border-soft bg-card px-3.5 py-3 text-left shadow-card transition-[border-color,box-shadow] hover:border-ai/40 hover:shadow-hover disabled:pointer-events-none disabled:opacity-50"
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${starter.tint}`}>
                <Icon size={15} />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{starter.title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-ink">{starter.prompt}</span>
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
