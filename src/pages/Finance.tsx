import { useState } from 'react'
import { motion } from 'framer-motion'
import { Tabs } from '@/components/ui/Tabs'
import { FinanceOverview } from '@/components/finance/FinanceOverview'
import { AccountsSection } from '@/components/finance/AccountsSection'
import { LiabilitiesSection } from '@/components/finance/LiabilitiesSection'
import { InvestmentsSection } from '@/components/finance/InvestmentsSection'
import { SipsSection } from '@/components/finance/SipsSection'
import { FINANCE_TABS, type FinanceTab } from '@/components/finance/financeTabs'
import { tabContent } from '@/lib/motion'

export function Finance() {
  const [tab, setTab] = useState<FinanceTab>('overview')

  return (
    <div className="flex flex-col gap-4 pt-3">
      <Tabs tabs={FINANCE_TABS} active={tab} onChange={(id) => setTab(id as FinanceTab)} className="w-fit" layoutId="finance-tabs-indicator" />

      <motion.div key={tab} variants={tabContent} initial="hidden" animate="visible">
        {tab === 'overview' && <FinanceOverview onSelectTab={setTab} />}
        {tab === 'accounts' && (
          <div className="flex flex-col gap-4">
            <AccountsSection />
            <LiabilitiesSection />
          </div>
        )}
        {tab === 'investments' && <InvestmentsSection />}
        {tab === 'sips' && <SipsSection />}
      </motion.div>
    </div>
  )
}
