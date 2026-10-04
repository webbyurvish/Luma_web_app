import { useState, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Combine, FileDown, FileImage, FileOutput, FileText, Images, LayoutGrid, Scissors, ShieldCheck, Shrink, SquareUserRound, type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SlideOver } from '@/components/ui/SlideOver'
import { useRouteIntent } from '@/hooks/useRouteIntent'
import { CompressTool, ImageFormatTool, ImagesToPdfTool, MergeTool, OfficeTool, OrganiseTool, PdfToImagesTool, SplitTool } from '@/components/filetools/tools'

interface ToolDef {
  id: string
  title: string
  detail: string
  icon: LucideIcon
  /** Runs through the user's Google Drive rather than on the phone. */
  drive?: boolean
  Component: ComponentType
}

const TOOLS: ToolDef[] = [
  { id: 'images-pdf', title: 'Photos → PDF', detail: 'Aadhaar, marksheets, receipts into one PDF', icon: Images, Component: ImagesToPdfTool },
  { id: 'office', title: 'Word, Excel, PowerPoint', detail: 'To PDF, or to another format', icon: FileOutput, drive: true, Component: () => <OfficeTool mode="office" /> },
  { id: 'pdf-word', title: 'PDF → Word', detail: 'Turn a PDF or a scan into editable text', icon: FileText, drive: true, Component: () => <OfficeTool mode="toWord" /> },
  { id: 'compress', title: 'Compress PDF', detail: 'Under 100 KB, 200 KB… for portals', icon: Shrink, Component: CompressTool },
  { id: 'merge', title: 'Merge PDFs', detail: 'Join several PDFs into one', icon: Combine, Component: MergeTool },
  { id: 'split', title: 'Split PDF', detail: 'Pull out pages, or every page apart', icon: Scissors, Component: SplitTool },
  { id: 'organise', title: 'Organise pages', detail: 'Reorder, rotate or remove pages', icon: LayoutGrid, Component: OrganiseTool },
  { id: 'pdf-images', title: 'PDF → photos', detail: 'Each page as a JPG or PNG', icon: FileImage, Component: PdfToImagesTool },
  { id: 'image-format', title: 'Change photo format', detail: 'HEIC, PNG, WebP ⇄ JPG', icon: FileDown, Component: ImageFormatTool },
]

export function FileTools() {
  const navigate = useNavigate()
  const [open, setOpen] = useState<ToolDef | null>(null)
  // Each open gets a fresh tool (no leftover files from last time).
  const [run, setRun] = useState(0)
  useRouteIntent((intent) => {
    const tool = TOOLS.find((t) => t.id === intent.tab)
    if (tool) {
      setRun((n) => n + 1)
      setOpen(tool)
    }
  })

  return (
    <div className="flex flex-col gap-4 pt-3">
      <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-ink-soft">
        <ShieldCheck size={14} className="mt-px shrink-0 text-success" />
        Your files stay private: most tools run on this phone, and Word / Excel / PowerPoint go through your own Google Drive — not a converter website.
      </p>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setRun((n) => n + 1)
              setOpen(t)
            }}
            className="group flex min-w-0 flex-col items-start gap-2 rounded-card border border-border-soft bg-card p-3.5 text-left transition-colors hover:border-rust/40 hover:bg-bg-soft/50 sm:p-4"
          >
            <span className="grid size-9 place-items-center rounded-md bg-rust-soft text-rust">
              <t.icon size={17} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold leading-snug text-ink">{t.title}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">{t.detail}</span>
            </span>
            {t.drive && <span className="rounded-full bg-bg-soft px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-ink-muted">via Google Drive</span>}
          </button>
        ))}
      </div>

      <Card className="flex items-center gap-3 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-amber-soft text-amber-ink">
          <SquareUserRound size={17} />
        </span>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => navigate('/family', { state: { tab: 'resizer' } })}>
          <p className="text-[13px] font-semibold text-ink">Photo & signature for forms</p>
          <p className="text-[11px] text-ink-muted">Exact size in px and KB for exam and government portals</p>
        </button>
        <ArrowRight size={15} className="shrink-0 text-ink-muted" />
      </Card>

      <SlideOver open={open !== null} onClose={() => setOpen(null)} title={open?.title ?? ''} subtitle={open?.detail} className="sm:w-[520px] md:w-[560px]">
        {open && <open.Component key={`${open.id}-${run}`} />}
      </SlideOver>
    </div>
  )
}
