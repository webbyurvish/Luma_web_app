import type { Liability } from '@/types'

// Credit card outstanding is derived from Accounts (type: 'credit_card') automatically.
// This list is only for standalone liabilities like loans — empty until the user adds one.
export const mockLiabilities: Liability[] = []
