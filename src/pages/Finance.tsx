import { OverviewBand } from '@/components/dashboard/OverviewBand'
import { CategoryDonut } from '@/components/dashboard/CategoryDonut'
import { IncomeExpenseChart } from '@/components/finance/IncomeExpenseChart'
import { PaymentMethodChart } from '@/components/finance/PaymentMethodChart'
import { mockFinanceSummary } from '@/data/mockExpenses'

export function Finance() {
  return (
    <div className="flex flex-col gap-4 pt-3">
      <OverviewBand summary={mockFinanceSummary} />

      <IncomeExpenseChart />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CategoryDonut />
        <PaymentMethodChart />
      </div>
    </div>
  )
}
