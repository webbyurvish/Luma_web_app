const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const exactFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const compactFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatCurrency(amount: number, options?: { compact?: boolean; signed?: boolean; exact?: boolean }): string {
  // exact keeps paise (₹356.50) where an amount must match a statement.
  const base = (options?.compact ? compactFormatter : options?.exact && !Number.isInteger(amount) ? exactFormatter : formatter).format(Math.abs(amount))
  if (options?.signed) {
    return amount < 0 ? `-${base}` : `+${base}`
  }
  return amount < 0 ? `-${base}` : base
}

export function formatPercentage(value: number, options?: { signed?: boolean; digits?: number }): string {
  const digits = options?.digits ?? 1
  const base = `${Math.abs(value).toFixed(digits)}%`
  if (options?.signed) {
    return value < 0 ? `-${base}` : `+${base}`
  }
  return base
}
