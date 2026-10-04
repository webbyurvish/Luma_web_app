import { lazy, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { NotFound } from '@/pages/NotFound'

/**
 * After a new deploy, a page left open still asks for the old chunk names, which are gone. A
 * failed chunk load therefore reloads once onto the new version instead of showing an error.
 */
function withReload<T>(load: () => Promise<T>): () => Promise<T> {
  return () =>
    load().then(
      (mod) => {
        sessionStorage.removeItem('luma-chunk-reload')
        return mod
      },
      (err: unknown) => {
        if (!sessionStorage.getItem('luma-chunk-reload')) {
          sessionStorage.setItem('luma-chunk-reload', '1')
          window.location.reload()
          return new Promise<T>(() => {})
        }
        throw err
      },
    )
}

/*
 * Every page is its own chunk, so the first screen downloads only what it shows. Once it has
 * rendered, the rest are fetched quietly in idle time — moving between pages stays instant.
 */
const pageLoaders = {
  Dashboard: withReload(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard }))),
  Finance: withReload(() => import('@/pages/Finance').then((m) => ({ default: m.Finance }))),
  Transactions: withReload(() => import('@/pages/Transactions').then((m) => ({ default: m.Transactions }))),
  Udhaar: withReload(() => import('@/pages/Udhaar').then((m) => ({ default: m.Udhaar }))),
  Tasks: withReload(() => import('@/pages/Tasks').then((m) => ({ default: m.Tasks }))),
  Documents: withReload(() => import('@/pages/Documents').then((m) => ({ default: m.Documents }))),
  Notes: withReload(() => import('@/pages/Notes').then((m) => ({ default: m.Notes }))),
  Family: withReload(() => import('@/pages/Family').then((m) => ({ default: m.Family }))),
  MonthlyReview: withReload(() => import('@/pages/MonthlyReview').then((m) => ({ default: m.MonthlyReview }))),
  Vehicles: withReload(() => import('@/pages/Vehicles').then((m) => ({ default: m.Vehicles }))),
  Health: withReload(() => import('@/pages/Health').then((m) => ({ default: m.Health }))),
  FileTools: withReload(() => import('@/pages/FileTools').then((m) => ({ default: m.FileTools }))),
  Vault: withReload(() => import('@/pages/Vault').then((m) => ({ default: m.Vault }))),
  Assistant: withReload(() => import('@/pages/Assistant').then((m) => ({ default: m.Assistant }))),
  Settings: withReload(() => import('@/pages/Settings').then((m) => ({ default: m.Settings }))),
}

const Dashboard = lazy(pageLoaders.Dashboard)
const Finance = lazy(pageLoaders.Finance)
const Transactions = lazy(pageLoaders.Transactions)
const Udhaar = lazy(pageLoaders.Udhaar)
const Tasks = lazy(pageLoaders.Tasks)
const Documents = lazy(pageLoaders.Documents)
const Notes = lazy(pageLoaders.Notes)
const Family = lazy(pageLoaders.Family)
const MonthlyReview = lazy(pageLoaders.MonthlyReview)
const Vehicles = lazy(pageLoaders.Vehicles)
const Health = lazy(pageLoaders.Health)
const FileTools = lazy(pageLoaders.FileTools)
const Vault = lazy(pageLoaders.Vault)
const Assistant = lazy(pageLoaders.Assistant)
const Settings = lazy(pageLoaders.Settings)

function usePrefetchPages() {
  useEffect(() => {
    // Safari (iPhone) has no requestIdleCallback; a short timeout stands in for it.
    const idle = (cb: () => void) => (typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(cb, { timeout: 4000 }) : setTimeout(cb, 2500))
    // A little after first paint, one page at a time so it never competes with real work.
    const id = window.setTimeout(() => {
      const queue = Object.values(pageLoaders)
      const next = () => {
        const load = queue.shift()
        if (load) void load().catch(() => {}).finally(() => idle(next))
      }
      idle(next)
    }, 1500)
    return () => window.clearTimeout(id)
  }, [])
}

function App() {
  usePrefetchPages()
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
        <Route path="/family" element={<Family />} />
        <Route path="/review" element={<MonthlyReview />} />
        <Route path="/vehicles" element={<Vehicles />} />
        <Route path="/health" element={<Health />} />
        <Route path="/tools" element={<FileTools />} />
        <Route path="/vault" element={<Vault />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App
