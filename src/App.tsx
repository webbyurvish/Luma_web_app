import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Dashboard } from '@/pages/Dashboard'
import { Finance } from '@/pages/Finance'
import { Transactions } from '@/pages/Transactions'
import { Udhaar } from '@/pages/Udhaar'
import { Tasks } from '@/pages/Tasks'
import { Documents } from '@/pages/Documents'
import { Notes } from '@/pages/Notes'
import { Assistant } from '@/pages/Assistant'
import { Settings } from '@/pages/Settings'
import { NotFound } from '@/pages/NotFound'

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/udhaar" element={<Udhaar />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App
