import { type FormEvent, useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import { MicButton } from './MicButton'
import { VoicePanel } from './VoicePanel'
import { useVoiceCapture } from '@/hooks/useVoiceCapture'
import { Spinner } from '@/components/ui/Loader'
import { QuickActionModal, type QuickActionKind } from '@/components/common/QuickActionModal'
import { useTransactions } from '@/hooks/useTransactions'
import { useUdhaar } from '@/hooks/useLifeCollections'
import { useAccounts } from '@/hooks/useFinanceCollections'
import { useToast } from '@/context/ToastContext'
import { CATEGORY_META } from '@/lib/categoryMeta'
import { todayIstDateKey } from '@/lib/formatDate'
import { parseQuickAdd, type QuickAddDraft } from '@/services/googleSheetsApi'
import { cn } from '@/lib/cn'

const KIND_FOR_DRAFT: Record<Exclude<QuickAddDraft['kind'], 'unknown'>, QuickActionKind> = {
  expense: 'expense',
  income: 'income',
  transfer: 'transfer',
  udhaar_given: 'udhaar',
  udhaar_repayment: 'repayment',
  task: 'task',
}

/**
 * "Tell Luma what happened": a typed or spoken sentence becomes a pre-filled form (expense,
 * income, udhaar, repayment or task). Nothing is saved until the user reviews it and presses Save.
 */
export function QuickAddBar({ className }: { className?: string }) {
  const { showToast } = useToast()
  const { transactions } = useTransactions()
  const { people } = useUdhaar()
  const { accounts } = useAccounts()

  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [editor, setEditor] = useState<{ kind: QuickActionKind; draft: QuickAddDraft } | null>(null)

  const submit = async (sentence: string) => {
    const value = sentence.trim()
    if (!value || parsing) return
    setText(value)
    setParsing(true)
    try {
      const hints = {
        categories: Array.from(new Set([...Object.values(CATEGORY_META).map((m) => m.label), ...transactions.map((t) => t.rawCategory ?? '')].filter(Boolean))),
        paymentMethods: Array.from(new Set(transactions.map((t) => t.payment).filter((p) => p && p !== 'Other'))),
        people: people.map((p) => p.name),
        accounts: accounts.filter((a) => a.isActive).map((a) => a.name),
      }
      const draft = await parseQuickAdd(value, todayIstDateKey(), hints)
      if (draft.kind === 'unknown') {
        showToast("I couldn't tell what to add. Try e.g. \"Spent 450 on Swiggy by UPI\" or \"Gave Rohit 2000\".", 'info')
        return
      }
      setEditor({ kind: KIND_FOR_DRAFT[draft.kind], draft })
      setText('')
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't understand that. Please try again.", 'error')
    } finally {
      setParsing(false)
    }
  }

  const voice = useVoiceCapture((spoken) => void submit(spoken))

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void submit(text)
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className={cn(
          'flex min-h-[52px] items-center gap-3 rounded-card border bg-card px-4 py-2 transition-colors focus-within:border-ai/60',
          voice.active ? 'border-rust/40 shadow-gold' : 'border-border-soft',
          className,
        )}
      >
        {voice.active ? (
          <VoicePanel state={voice.state} interim={voice.interim} onFinish={voice.finish} onCancel={voice.cancel} />
        ) : (
          <>
            {parsing ? <Spinner size={15} className="text-ai" /> : <Sparkles size={15} className="shrink-0 text-ai" />}
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={parsing}
              placeholder={parsing ? 'Reading that…' : 'Tell Luma what happened — "Paid 450 at Swiggy from HDFC by UPI" or "Gave Rohit 2000"'}
              aria-label="Describe a transaction, udhaar or task"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none disabled:opacity-60"
            />
            <MicButton onClick={() => void voice.start()} />
            <button
              type="submit"
              aria-label="Fill in the form"
              disabled={!text.trim() || parsing}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ai text-on-accent transition-opacity disabled:opacity-30"
            >
              <ArrowRight size={14} />
            </button>
          </>
        )}
      </form>

      <QuickActionModal open={editor !== null} kind={editor?.kind ?? 'expense'} draft={editor?.draft} onClose={() => setEditor(null)} />
    </>
  )
}
