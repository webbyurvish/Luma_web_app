import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Tabs } from '@/components/ui/Tabs'
import { DatesSection } from '@/components/family/DatesSection'
import { RechargesSection } from '@/components/family/RechargesSection'
import { FormKitSection } from '@/components/family/FormKitSection'
import { PhotoResizer } from '@/components/family/PhotoResizer'
import { useImportantDates, useRecharges } from '@/hooks/useFamily'
import { useRouteIntent } from '@/hooks/useRouteIntent'
import { tabContent } from '@/lib/motion'

const TABS = [
  { id: 'dates', label: 'Dates' },
  { id: 'recharges', label: 'Recharges' },
  { id: 'formkit', label: 'Form kit' },
  { id: 'resizer', label: 'Photo resizer' },
]

export function Family() {
  const [tab, setTab] = useState('dates')
  useRouteIntent((intent) => {
    if (intent.tab && TABS.some((t) => t.id === intent.tab)) setTab(intent.tab)
  })
  const { dates } = useImportantDates()
  const { recharges } = useRecharges()
  // Names already used anywhere in Family, offered as suggestions so "Mom" stays "Mom".
  const knownPeople = useMemo(
    () => [...new Set([...dates.map((d) => d.person), ...recharges.map((r) => r.person), 'Me', 'Mom', 'Dad'].filter(Boolean))].sort(),
    [dates, recharges],
  )

  return (
    <div className="flex flex-col gap-4 pt-3">
      <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        <Tabs tabs={TABS} active={tab} onChange={setTab} className="w-fit" layoutId="family-tabs-indicator" />
      </div>
      <motion.div key={tab} variants={tabContent} initial="hidden" animate="visible">
        {tab === 'dates' && <DatesSection knownPeople={knownPeople} />}
        {tab === 'recharges' && <RechargesSection knownPeople={knownPeople} />}
        {tab === 'formkit' && <FormKitSection />}
        {tab === 'resizer' && <PhotoResizer />}
      </motion.div>
    </div>
  )
}
