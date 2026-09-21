import { motion } from 'framer-motion'
import { LumaSpark } from './LumaSpark'
import { fadeUp } from '@/lib/motion'
import { mockSuggestedPrompts } from '@/data/mockAssistant'

export function AssistantEmptyState({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <LumaSpark size={44} animated />
      <h2 className="mt-5 text-lg font-semibold tracking-tight text-ink">Your personal intelligence layer</h2>
      <p className="mt-1.5 max-w-sm text-sm text-ink-soft">
        Ask about your finances, documents, tasks or anything you've stored in Luma.
      </p>

      <div className="mt-7 grid w-full max-w-md grid-cols-1 gap-2.5 sm:grid-cols-2">
        {mockSuggestedPrompts.slice(0, 4).map((prompt, index) => (
          <motion.button
            key={prompt.id}
            custom={index}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            onClick={() => onPrompt(prompt.label)}
            className="rounded-btn border border-border-soft bg-card px-4 py-3 text-left text-xs font-medium text-ink-soft shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-ai hover:text-ai hover:shadow-ai"
          >
            {prompt.label}
          </motion.button>
        ))}
      </div>
    </div>
  )
}
