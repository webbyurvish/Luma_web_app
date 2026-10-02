import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Luma's own theme names (index.css @theme), so e.g. rounded-btn and rounded-full are known to conflict.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ['xs', 'sm', 'md', 'btn', 'card', 'hero', 'pill'],
      shadow: ['xs', 'card', 'hover', 'gold', 'ai', 'dropdown'],
    },
  },
})

/**
 * Joins class names and resolves Tailwind conflicts so the LAST one wins — e.g. a screen passing
 * className="p-0" to a Card (which has p-4) really gets p-0, instead of whichever rule happens
 * to come later in the stylesheet.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
