import { useMemo, useState } from 'react'
import { Briefcase, FileText, Landmark, Search, ShieldCheck, Upload, User, Wallet } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { DocumentCategoryCard } from '@/components/documents/DocumentCategoryCard'
import { DocumentCard } from '@/components/documents/DocumentCard'
import { QuickActionModal } from '@/components/common/QuickActionModal'
import { mockDocumentCategories, mockDocuments } from '@/data/mockDocuments'
import type { AppDocument } from '@/types'

const categoryStyle: Record<AppDocument['category'], { icon: typeof ShieldCheck; color: string; bg: string }> = {
  Insurance: { icon: ShieldCheck, color: 'var(--color-info)', bg: 'var(--color-info-soft)' },
  Finance: { icon: Wallet, color: 'var(--color-success)', bg: 'var(--color-success-soft)' },
  Bills: { icon: Landmark, color: 'var(--color-warning)', bg: 'var(--color-warning-soft)' },
  Personal: { icon: User, color: 'var(--color-pink)', bg: 'var(--color-pink-soft)' },
  Work: { icon: Briefcase, color: 'var(--color-ai)', bg: 'var(--color-ai-soft)' },
  Other: { icon: FileText, color: 'var(--color-ink-soft)', bg: 'var(--color-bg-soft)' },
}

export function Documents() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<AppDocument['category'] | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)

  const filtered = useMemo(() => {
    return mockDocuments.filter((doc) => {
      const matchesSearch = doc.name.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = !activeCategory || doc.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [search, activeCategory])

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="sm:w-80">
          <Input icon={<Search size={16} />} placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button icon={<Upload size={15} />} onClick={() => setUploadOpen(true)}>
          Upload Document
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {mockDocumentCategories.map((category) => {
          const style = categoryStyle[category.name]
          return (
            <DocumentCategoryCard
              key={category.name}
              name={category.name}
              count={category.count}
              icon={style.icon}
              color={style.color}
              bg={style.bg}
              active={activeCategory === category.name}
              onClick={() => setActiveCategory((prev) => (prev === category.name ? null : category.name))}
            />
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText size={22} />}
          title="No documents yet"
          description="Upload your first document to keep everything organized."
          action={
            <Button icon={<Upload size={15} />} onClick={() => setUploadOpen(true)}>
              Upload Document
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((document) => (
            <DocumentCard key={document.id} document={document} />
          ))}
        </div>
      )}

      <QuickActionModal open={uploadOpen} kind="document" onClose={() => setUploadOpen(false)} />
    </div>
  )
}
