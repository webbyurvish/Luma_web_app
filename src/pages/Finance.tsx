import { KPIGrid } from '@/components/dashboard/KPIGrid'
import { CategoryChart } from '@/components/dashboard/CategoryChart'
import { IncomeExpenseChart } from '@/components/finance/IncomeExpenseChart'
import { PaymentMethodChart } from '@/components/finance/PaymentMethodChart'
import { mockFinanceSummary } from '@/data/mockExpenses'

export function Finance() {
  return (
    <div className="flex flex-col gap-5 pt-4">
      <KPIGrid summary={mockFinanceSummary} />

      <IncomeExpenseChart />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <CategoryChart />
        <PaymentMethodChart />
      </div>
    </div>
  )
}
