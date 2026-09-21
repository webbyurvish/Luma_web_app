import { motion } from 'framer-motion'
import { LumaSpark } from './LumaSpark'
import { fadeUp } from '@/lib/motion'
import { mockSuggestedPrompts } from '@/data/mockAssistant'

export function AssistantEmptyState({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
      <LumaSpark size={36} animated />
      <h2 className="mt-4 font-display text-xl italic text-ink">Your personal intelligence layer</h2>
      <p className="mt-1.5 max-w-sm text-xs text-ink-soft">
        Ask about your finances, documents, tasks or anything you've stored in Luma.
      </p>

      <ul className="mt-6 space-y-2">
        {mockSuggestedPrompts.slice(0, 4).map((prompt, index) => (
          <motion.li key={prompt.id} custom={index} variants={fadeUp} initial="hidden" animate="visible">
            <button
              onClick={() => onPrompt(prompt.label)}
              className="ledger-marker pl-3 text-xs text-ink-soft transition-colors hover:text-ai [&::before]:opacity-0 hover:[&::before]:opacity-100"
            >
              {prompt.label}
            </button>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
