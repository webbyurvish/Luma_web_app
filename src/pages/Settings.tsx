import { useState } from 'react'
import { Bell, CreditCard, Palette, ShieldCheck, User } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { useToast } from '@/context/ToastContext'

const sections = [
  { id: 'profile', label: 'Profile' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'finance', label: 'Finance' },
  { id: 'security', label: 'Security' },
]

export function Settings() {
  const { showToast } = useToast()
  const [active, setActive] = useState('profile')
  const [notifyExpense, setNotifyExpense] = useState(true)
  const [notifyUdhaar, setNotifyUdhaar] = useState(true)
  const [notifyTasks, setNotifyTasks] = useState(false)

  const handleSave = () => showToast('Settings saved (demo — not persisted yet)')

  return (
    <div className="flex flex-col gap-4 pt-3">
      <Tabs tabs={sections} active={active} onChange={setActive} className="w-fit" />

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
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">Theme</label>
            <Select defaultValue="light">
              <option value="light">Light</option>
              <option value="dark" disabled>
                Dark (coming soon)
              </option>
            </Select>
          </div>
        </Card>
      )}

      {active === 'notifications' && (
        <Card hoverable className="max-w-2xl">
          <CardHeader title="Notifications" subtitle="Choose what you want to be notified about" icon={<Bell size={17} className="text-ink-soft" />} />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">Expense alerts</p>
                <p className="text-xs text-ink-soft">Get notified for large or unusual expenses</p>
              </div>
              <Switch checked={notifyExpense} onChange={setNotifyExpense} label="Expense alerts" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">Udhaar reminders</p>
                <p className="text-xs text-ink-soft">Reminders for money you're owed</p>
              </div>
              <Switch checked={notifyUdhaar} onChange={setNotifyUdhaar} label="Udhaar reminders" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">Task reminders</p>
                <p className="text-xs text-ink-soft">Daily summary of pending tasks</p>
              </div>
              <Switch checked={notifyTasks} onChange={setNotifyTasks} label="Task reminders" />
            </div>
          </div>
        </Card>
      )}

      {active === 'finance' && (
        <Card hoverable className="max-w-2xl">
          <CardHeader title="Finance Preferences" subtitle="Defaults used across the app" icon={<CreditCard size={17} className="text-ink-soft" />} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">Currency</label>
              <Select defaultValue="INR">
                <option value="INR">INR ₹</option>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-soft">Default Payment Method</label>
              <Select defaultValue="UPI">
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Net Banking">Net Banking</option>
              </Select>
            </div>
          </div>
          <Button className="mt-5" onClick={handleSave}>
            Save Preferences
          </Button>
        </Card>
      )}

      {active === 'security' && (
        <Card hoverable className="max-w-2xl">
          <CardHeader title="Security" subtitle="Keep your account safe" icon={<ShieldCheck size={17} className="text-ink-soft" />} />
          <p className="text-sm text-ink-soft">
            Authentication and account security will be available once accounts are introduced in a future phase.
          </p>
        </Card>
      )}
    </div>
  )
}
