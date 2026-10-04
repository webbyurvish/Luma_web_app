import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, CreditCard, Palette, User } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { Input } from '@/components/ui/Input'
import { ThemedSelect } from '@/components/ui/ThemedSelect'
import { Switch } from '@/components/ui/Switch'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { useToast } from '@/context/ToastContext'
import { tabContent } from '@/lib/motion'
import { SecuritySettings } from '@/components/settings/SecuritySettings'
import { BiometricSettings } from '@/components/settings/BiometricSettings'
import { BackupSettings } from '@/components/settings/BackupSettings'
import { useRouteIntent } from '@/hooks/useRouteIntent'
import { NOTIFY_KINDS, setNotifyPref, useNotifyPrefs } from '@/lib/notifyPrefs'
import { setThemePref, useThemePref, type ThemePref } from '@/lib/theme'
import { cn } from '@/lib/cn'

const sections = [
  { id: 'profile', label: 'Profile' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'finance', label: 'Finance' },
  { id: 'security', label: 'Security' },
  { id: 'backups', label: 'Backups' },
]

export function Settings() {
  const { showToast } = useToast()
  const [active, setActive] = useState('profile')
  useRouteIntent((intent) => {
    if (intent.tab) setActive(intent.tab)
  })
  const notifyPrefs = useNotifyPrefs()
  const [currency, setCurrency] = useState('INR')
  const [defaultPayment, setDefaultPayment] = useState('UPI')

  const handleSave = () => showToast('Settings saved (demo — not persisted yet)')

  return (
    <div className="flex flex-col gap-4 pt-3">
      <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        <Tabs tabs={sections} active={active} onChange={setActive} className="w-fit" layoutId="settings-tabs-indicator" />
      </div>

      <motion.div key={active} variants={tabContent} initial="hidden" animate="visible" className="flex flex-col gap-4">
      {active === 'profile' && (
        <Card hoverable className="max-w-2xl">
          <CardHeader title="Profile" subtitle="Your personal information" icon={<User size={17} className="text-ink-soft" />} />
          <div className="mb-5 flex items-center gap-4">
            <Avatar name="Urvish Krina" size={56} />
            <div>
              <p className="text-sm font-semibold text-ink">Urvish Krina</p>
              <p className="text-xs text-ink-soft">urvishkrina@gmail.com</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">Full Name</label>
              <Input defaultValue="Urvish Krina" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">Email</label>
              <Input defaultValue="urvishkrina@gmail.com" type="email" />
            </div>
          </div>
          <Button className="mt-5" onClick={handleSave}>
            Save Changes
          </Button>
        </Card>
      )}

      {active === 'appearance' && (
        <Card hoverable className="max-w-2xl">
          <CardHeader title="Appearance" subtitle="Personalize how Luma looks" icon={<Palette size={17} className="text-ink-soft" />} />
          <ThemePicker />
        </Card>
      )}

      {active === 'notifications' && (
        <Card hoverable className="max-w-2xl">
          <CardHeader title="Notifications" subtitle="What the bell alerts you about" icon={<Bell size={17} className="text-ink-soft" />} />
          <div className="divide-y divide-border-soft">
            {NOTIFY_KINDS.map((k) => (
              <div key={k.kind} className="flex items-center justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{k.title}</p>
                  <p className="text-xs text-ink-soft">{k.detail}</p>
                </div>
                <Switch checked={notifyPrefs[k.kind]} onChange={(on) => setNotifyPref(k.kind, on)} label={k.title} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-ink-muted">Changes apply to the bell right away, on this device.</p>
        </Card>
      )}

      {active === 'finance' && (
        <Card hoverable className="max-w-2xl">
          <CardHeader title="Finance Preferences" subtitle="Defaults used across the app" icon={<CreditCard size={17} className="text-ink-soft" />} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ThemedSelect label="Currency" value={currency} onChange={setCurrency} options={[{ value: 'INR', label: 'INR ₹' }]} />
            <ThemedSelect
              label="Default Payment Method"
              value={defaultPayment}
              onChange={setDefaultPayment}
              options={[
                { value: 'UPI', label: 'UPI' },
                { value: 'Card', label: 'Card' },
                { value: 'Cash', label: 'Cash' },
                { value: 'Bank Transfer', label: 'Bank Transfer' },
                { value: 'Net Banking', label: 'Net Banking' },
              ]}
            />
          </div>
          <Button className="mt-5" onClick={handleSave}>
            Save Preferences
          </Button>
        </Card>
      )}

      {active === 'security' && (
        <>
          <SecuritySettings />
          <BiometricSettings />
        </>
      )}
      {active === 'backups' && <BackupSettings />}
      </motion.div>
    </div>
  )
}

/* Each option is a miniature of the real theme: rail, hero panel and a row. */
const THEME_OPTIONS: { value: ThemePref; label: string; detail: string }[] = [
  { value: 'light', label: 'Editorial', detail: 'Paper, forest green and amber' },
  { value: 'dark', label: 'Midnight', detail: 'Navy and gold, easy on the eyes at night' },
  { value: 'auto', label: 'Auto', detail: "Follows your phone's light or dark mode" },
]

const SWATCH = {
  light: { bg: '#f4efe4', rail: '#22302b', hero: '#2f4a40', heroInk: '#f1ebdc', accent: '#e3a35b', row: '#fbf8f1', line: 'rgba(38,48,44,0.15)' },
  dark: { bg: '#0e1424', rail: '#0a0f1c', hero: '#1a2440', heroInk: '#f3ebd7', accent: '#d4a84b', row: '#151d32', line: 'rgba(220,225,238,0.14)' },
}

function Mini({ theme }: { theme: 'light' | 'dark' }) {
  const c = SWATCH[theme]
  return (
    <div className="flex h-full w-full" style={{ background: c.bg }}>
      <div className="w-[18%]" style={{ background: c.rail }} />
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <div className="rounded-[5px] p-1.5" style={{ background: c.hero }}>
          <div className="h-1 w-6 rounded-full opacity-60" style={{ background: c.heroInk }} />
          <div className="mt-1 h-2 w-12 rounded-full" style={{ background: c.heroInk }} />
          <div className="mt-1.5 h-1 rounded-full" style={{ background: c.accent, width: '62%' }} />
        </div>
        <div className="h-3 rounded-[4px]" style={{ background: c.row, border: `1px solid ${c.line}` }} />
        <div className="h-3 rounded-[4px]" style={{ background: c.row, border: `1px solid ${c.line}` }} />
      </div>
    </div>
  )
}

function ThemePicker() {
  const { pref, theme } = useThemePref()
  return (
    <div>
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3" role="radiogroup" aria-label="Theme">
        {THEME_OPTIONS.map((o) => {
          const on = pref === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setThemePref(o.value)}
              className={cn('min-w-0 rounded-card border p-1.5 text-left transition-colors', on ? 'border-rust ring-2 ring-rust/30' : 'border-border hover:border-ink-soft')}
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-border-soft">
                {o.value === 'auto' ? (
                  <div className="flex h-full">
                    <div className="w-1/2 overflow-hidden">
                      <div className="h-full w-[200%]">
                        <Mini theme="light" />
                      </div>
                    </div>
                    <div className="w-1/2 overflow-hidden">
                      <div className="h-full w-[200%] -translate-x-1/2">
                        <Mini theme="dark" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <Mini theme={o.value} />
                )}
              </div>
              <p className="mt-2 px-0.5 text-[13px] font-semibold text-ink">{o.label}</p>
              <p className="px-0.5 pb-0.5 text-[11px] leading-snug text-ink-muted">{o.detail}</p>
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-[11px] text-ink-muted">
        Showing {theme === 'dark' ? 'Midnight' : 'Editorial'} now. Saved on this device.
      </p>
    </div>
  )
}
