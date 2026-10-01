import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Tabs } from '@/components/ui/Tabs'
import { FinanceOverview } from '@/components/finance/FinanceOverview'
import { AccountsSection } from '@/components/finance/AccountsSection'
import { LiabilitiesSection } from '@/components/finance/LiabilitiesSection'
import { InvestmentsSection } from '@/components/finance/InvestmentsSection'
import { SipsSection } from '@/components/finance/SipsSection'
import { BillsSection } from '@/components/planning/BillsSection'
import { BudgetsSection } from '@/components/planning/BudgetsSection'
import { useLocation } from 'react-router-dom'
import { FINANCE_TABS, type FinanceTab } from '@/components/finance/financeTabs'
import { tabContent } from '@/lib/motion'
import { useAccounts } from '@/hooks/useFinanceCollections'

export function Finance() {
  // Notifications can open a specific tab (e.g. Bills) via router state.
  const location = useLocation()
  const requestedTab = (location.state as { tab?: FinanceTab } | null)?.tab
  const [tab, setTab] = useState<FinanceTab>(requestedTab ?? 'overview')
  useEffect(() => {
    if (requestedTab) setTab(requestedTab)
  }, [requestedTab, location.key])
  // Accounts is needed by up to 3 of these 4 tabs (Accounts, Investments, SIPs) for
  // platform lookups — fetched once here instead of once per section to avoid firing
  // several simultaneous requests at the same endpoint when a tab mounts.
  const accountsState = useAccounts()

  return (
    <div className="flex flex-col gap-4 pt-3">
      <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        <Tabs tabs={FINANCE_TABS} active={tab} onChange={(id) => setTab(id as FinanceTab)} className="w-fit" layoutId="finance-tabs-indicator" />
      </div>

      <motion.div key={tab} variants={tabContent} initial="hidden" animate="visible">
        {tab === 'overview' && <FinanceOverview onSelectTab={setTab} />}
        {tab === 'accounts' && (
          <div className="flex flex-col gap-4">
            <AccountsSection accountsState={accountsState} />
            <LiabilitiesSection accounts={accountsState.accounts} />
          </div>
        )}
        {tab === 'bills' && <BillsSection />}
        {tab === 'budgets' && <BudgetsSection />}
        {tab === 'investments' && <InvestmentsSection accounts={accountsState.accounts} />}
        {tab === 'sips' && <SipsSection accounts={accountsState.accounts} />}
      </motion.div>
    </div>
  )
}
