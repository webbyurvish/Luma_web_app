import type { FinancialAccount, Transaction } from '@/types'
import type { GpayRow } from './gpayStatement'

/**
 * Turns parsed Google Pay rows into suggestions: which Luma account each bank in the
 * statement is, and a category for each payee — from the user's own history first
 * (what they chose for this payee before), then from built-in rules for common Indian merchants.
 */

export type CategorySource = 'history' | 'rule' | 'none'

export interface CategoryGuess {
  category: string
  subcategory: string
  source: CategorySource
}

/** "SWIGGY LIMITED", "Swiggy" and "swiggy.in" all become "swiggy". */
export function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/@[\w.-]+/g, ' ')
    .replace(/\b(pvt|private|ltd|limited|llp|inc|india|technologies|technology|services|the|m\/s|\.com|\.in)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const RULES: { test: RegExp; category: string; subcategory: string }[] = [
  { test: /swiggy|bundl|zomato|eatsure|domino|pizza|mcdonald|kfc|burger|starbucks|cafe|restaurant|dhaba|biryani|haldiram|chaayos|bakery|sweets|ice ?cream|juice|vada ?pa[vu]|\bpaa?n\b|soda|\bchai\b|\btea\b|nasta|farsan|dabeli|pani ?puri/, category: 'Food', subcategory: 'Restaurant' },
  { test: /blinkit|grofers|zepto|bigbasket|instamart|dmart|avenue supermarts|reliance (fresh|smart|retail)|jiomart|more retail|metro cash|kirana|provision|flour|\batta\b|chakki|general store|dairy|milk|vegetable|fruits/, category: 'Food', subcategory: 'Groceries' },
  { test: /\buber\b|\bola\b|ani technologies|rapido|roppen|blusmart|namma yatri|\bauto\b/, category: 'Transport', subcategory: 'Cab' },
  { test: /irctc|railway/, category: 'Transport', subcategory: 'Train' },
  { test: /redbus|abhibus|ksrtc|msrtc|gsrtc|\bbus\b/, category: 'Transport', subcategory: 'Bus' },
  { test: /metro/, category: 'Transport', subcategory: 'Metro' },
  { test: /indigo|interglobe|air india|akasa|spicejet|vistara|makemytrip|goibibo|cleartrip|ixigo|easemytrip/, category: 'Transport', subcategory: 'Travel' },
  { test: /petrol|petroleum|\bhpcl\b|\bbpcl\b|indian oil|iocl|\bfuel|\bcng\b|shell|nayara|filling station|service station/, category: 'Transport', subcategory: 'Fuel' },
  { test: /fastag|toll|parking/, category: 'Transport', subcategory: 'Tolls & parking' },
  { test: /\bjio\b|reliance jio|airtel|bharti|vodafone|\bvi\b|\bidea\b|bsnl|recharge|telecom/, category: 'Bills', subcategory: 'Mobile recharge' },
  { test: /electricity|\bpower\b|discom|bescom|msedcl|mahavitaran|tata power|adani (electricity|energy)|torrent|uhbvn|dhbvn|pgvcl|mgvcl|ugvcl|dgvcl|tneb|tangedco|kseb|cesc|bses/, category: 'Bills', subcategory: 'Electricity' },
  { test: /\bgas\b|indane|bharat gas|hp gas|mahanagar gas|adani total|gujarat gas|igl\b/, category: 'Bills', subcategory: 'Gas' },
  { test: /broadband|fiber|fibre|act fibernet|hathway|excitel|tata play|dish ?tv|d2h|sun direct|dth/, category: 'Bills', subcategory: 'Internet & TV' },
  { test: /\bwater\b|municipal|nagar nigam|corporation tax|property tax/, category: 'Bills', subcategory: 'Water & tax' },
  { test: /insurance|\blic\b|policybazaar|acko|\bdigit\b|hdfc ergo|icici lombard|star health|niva bupa|care health/, category: 'Bills', subcategory: 'Insurance' },
  { test: /credit card|card bill|cred\b|cheq/, category: 'Bills', subcategory: 'Credit card' },
  { test: /amazon|flipkart|myntra|ajio|meesho|nykaa|tata cliq|snapdeal|croma|reliance digital|vijay sales|decathlon|ikea|lifestyle|westside|pantaloons|shoppers stop|zudio|trends/, category: 'Shopping', subcategory: 'Online & stores' },
  { test: /netflix|hotstar|disney|prime video|spotify|youtube|sonyliv|zee5|jiocinema|bookmyshow|pvr|inox|cinepolis|steam|playstation/, category: 'Entertainment', subcategory: 'Subscriptions & movies' },
  { test: /apollo|pharm|medic|chemist|1mg|netmeds|pharmeasy|hospital|clinic|diagnostic|\blabs?\b|\bdr\b|doctor|dental|practo|healthkart|cult|gym|fitness/, category: 'Health', subcategory: 'Medical' },
  { test: /\brent\b|nobroker|society|maintenance|urban company|urbanclap|housejoy|plumber|electrician|furniture|hardware/, category: 'Home', subcategory: 'Rent & upkeep' },
  { test: /school|college|universit|academy|tuition|classes|byju|unacademy|vedantu|udemy|coursera/, category: 'Other', subcategory: 'Education' },
  { test: /zerodha|groww|upstox|angel one|angel broking|kuvera|paytm money|mutual fund|\bsip\b|nps|ppf/, category: 'Other', subcategory: 'Investments' },
]

const RECEIVED_RULES: { test: RegExp; subcategory: string }[] = [
  { test: /refund|reversal|cashback|reward/, subcategory: 'Refund' },
  { test: /salary|payroll/, subcategory: 'Salary' },
  { test: /interest/, subcategory: 'Interest' },
  { test: /dividend/, subcategory: 'Dividend' },
]

export interface CategoryHistory {
  get(merchant: string): { category: string; subcategory: string } | undefined
}

/** The latest category the user chose for each payee, keyed by normalized name. */
export function buildCategoryHistory(transactions: Transaction[]): CategoryHistory {
  const map = new Map<string, { category: string; subcategory: string; at: string }>()
  for (const t of transactions) {
    if (!t.merchant || !t.rawCategory || t.type === 'transfer') continue
    const key = normalizeMerchant(t.merchant)
    if (!key) continue
    const at = `${t.date} ${t.time}`
    const prev = map.get(key + '|' + t.type)
    if (!prev || prev.at < at) map.set(key + '|' + t.type, { category: t.rawCategory, subcategory: t.rawSubcategory ?? '', at })
  }
  return {
    get: (merchant) => map.get(merchant),
  }
}

export function guessCategory(row: GpayRow, history: CategoryHistory): CategoryGuess {
  const key = normalizeMerchant(row.payee)
  const type = row.direction === 'credit' ? 'income' : 'expense'
  const past = history.get(key + '|' + type)
  if (past) return { ...past, source: 'history' }
  if (row.direction === 'credit') {
    const r = RECEIVED_RULES.find((x) => x.test.test(key))
    return { category: 'Income', subcategory: r?.subcategory ?? 'Received', source: 'rule' }
  }
  const rule = RULES.find((x) => x.test.test(key))
  if (rule) return { category: rule.category, subcategory: rule.subcategory, source: 'rule' }
  return { category: '', subcategory: '', source: 'none' }
}

// ---- Bank in the statement → Luma account -------------------------------------------------

const MAP_KEY = 'lumaui:gpay-account-map'

export function bankKey(row: Pick<GpayRow, 'bankName' | 'last4'>): string {
  return `${row.bankName.toLowerCase().replace(/\s+/g, ' ').trim()}|${row.last4}`
}

function readMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(MAP_KEY) || '{}') as Record<string, string>
  } catch {
    return {}
  }
}

export function rememberBankAccount(key: string, accountId: string) {
  try {
    const map = readMap()
    if (accountId) map[key] = accountId
    else delete map[key]
    localStorage.setItem(MAP_KEY, JSON.stringify(map))
  } catch {
    /* private mode: the choice just isn't remembered */
  }
}

const BANK_WORDS = /\b(bank|ltd|limited|of|india|the|co|operative|cooperative)\b/g
const squash = (s: string) => s.toLowerCase().replace(BANK_WORDS, ' ').replace(/[^a-z0-9]+/g, '')

/** Remembered choice, else the account with the same last 4 digits, else the same bank name. */
export function matchBankAccount(accounts: FinancialAccount[], bankName: string, last4: string): string {
  const active = accounts.filter((a) => a.isActive)
  const remembered = readMap()[bankKey({ bankName, last4 })]
  if (remembered && active.some((a) => a.id === remembered)) return remembered
  if (last4) {
    const byDigits = active.filter((a) => a.accountNumberLast4 === last4)
    if (byDigits.length === 1) return byDigits[0].id
  }
  const bank = squash(bankName)
  if (!bank) return ''
  const sameBank = active.filter((a) => {
    const names = [a.institution ?? '', a.name].map(squash).filter(Boolean)
    // A same-bank account whose last 4 digits differ is a different account (HDFC ••4321 ≠ HDFC ••6667).
    if (last4 && a.accountNumberLast4 && a.accountNumberLast4 !== last4) return false
    return a.type !== 'credit_card' && names.some((n) => n.includes(bank) || bank.includes(n) || initials(bankName) === n)
  })
  return sameBank.length === 1 ? sameBank[0].id : ''
}

/** "State Bank of India" → "sbi", "Housing Development Finance Corporation" → "hdfc". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => w && !/^(of|the|ltd|limited|co)$/i.test(w))
    .map((w) => w[0])
    .join('')
    .toLowerCase()
}
