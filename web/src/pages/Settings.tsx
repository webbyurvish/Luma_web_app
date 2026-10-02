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
  const [theme, setTheme] = useState('light')
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
          <ThemedSelect
            label="Theme"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark (coming soon)', disabled: true },
            ]}
          />
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
