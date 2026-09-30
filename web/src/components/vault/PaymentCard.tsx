import { Wifi } from 'lucide-react'
import { cn } from '@/lib/cn'
import { cardNetwork, expiryState, formatCardNumber } from '@/lib/vaultMeta'

interface PaymentCardProps {
  title: string
  issuer?: string
  holder?: string
  number?: string
  expiry?: string
  kind?: string
  /** Full number visible (only while the user has revealed it). */
  revealed: boolean
}

/** A card-shaped summary: issuer, network, the last four digits (or all, when revealed), expiry. */
export function PaymentCard({ title, issuer, holder, number = '', expiry, kind, revealed }: PaymentCardProps) {
  const network = cardNetwork(number)
  const digits = number.replace(/\D/g, '')
  const shown = revealed ? formatCardNumber(number) : digits ? `•••• •••• •••• ${digits.slice(-4)}` : '•••• •••• •••• ••••'
  const exp = expiryState(expiry)

  return (
    <div className="relative aspect-[1.586] w-full max-w-[340px] overflow-hidden rounded-[18px] bg-gradient-to-br from-[#2c2620] via-[#3b2f24] to-[#7a3f22] p-5 text-[#F6F1E7] shadow-hover">
      <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/[0.06]" />
      <div className="pointer-events-none absolute -bottom-20 -left-8 h-44 w-44 rounded-full bg-white/[0.04]" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">{issuer || title}</p>
            {kind && <p className="text-[10px] uppercase tracking-[0.12em] text-[#F6F1E7]/60">{kind} card</p>}
          </div>
          <Wifi size={16} className="rotate-90 text-[#F6F1E7]/60" />
        </div>
        <div className="mt-auto">
          <div className="mb-3 h-7 w-10 rounded-[5px] bg-gradient-to-br from-[#e8c77d] to-[#b48a3c] opacity-90" />
          <p className="font-mono-figure text-[17px] tracking-[0.08em] sm:text-lg">{shown}</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[8.5px] uppercase tracking-[0.14em] text-[#F6F1E7]/55">Card holder</p>
              <p className="truncate text-[11.5px] font-medium uppercase tracking-wide">{holder || '—'}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[8.5px] uppercase tracking-[0.14em] text-[#F6F1E7]/55">Expires</p>
              <p className={cn('font-mono-figure text-[11.5px] font-medium', exp === 'expired' && 'text-[#ff9b8a]', exp === 'soon' && 'text-[#ffd37a]')}>{expiry || '—'}</p>
            </div>
            {network && <p className="shrink-0 text-[15px] font-bold italic tracking-tight">{network}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
