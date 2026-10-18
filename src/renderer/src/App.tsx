import { useState } from 'react'
import { useMotionValue } from 'motion/react'
import { ArrowUp, Plus } from 'lucide-react'
import { Player } from './player/Player'
import { Preview } from './Preview'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { type Storyboard, duration } from '../../shared/schema'
import { demo } from '../../shared/demo'

// A still frame of the video, used wherever a thumbnail is needed.
function Thumb({ sb, at = 1.5 }: { sb: Storyboard; at?: number }): React.JSX.Element {
  return <Player sb={{ ...sb, format: 'landscape' }} time={useMotionValue(at)} />
}

function VideoCard({ sb, onOpen }: { sb: Storyboard; onOpen: () => void }): React.JSX.Element {
  const d = Math.round(duration(sb))
  return (
    <button onClick={onOpen} className="group flex w-96 flex-col gap-2 text-left">
      <div className="relative overflow-hidden rounded-xl ring-primary group-hover:ring-2">
        <Thumb sb={sb} />
        <span className="absolute right-2 bottom-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
          {Math.floor(d / 60)}:{String(d % 60).padStart(2, '0')}
        </span>
      </div>
      <span className="line-clamp-2 font-medium">{sb.title}</span>
      <span className="flex gap-1.5">
        {[sb.kind, sb.tone, sb.format].map((c) => (
          <Badge key={c} variant="secondary" className="rounded-full">
            {c}
          </Badge>
        ))}
      </span>
    </button>
  )
}

function App(): React.JSX.Element {
  // shortcut: one hard-coded chat; real chats, storage and generation arrive in milestone 3 and 8.
  const [sb, setSb] = useState(demo)
  const [open, setOpen] = useState(false)
  return (
    <div className="flex h-screen">
      <nav className="flex w-64 shrink-0 flex-col gap-2 border-r p-3">
        <div className="px-2 py-1 text-lg font-bold tracking-tight">Reelwright</div>
        <Button variant="secondary" className="justify-start rounded-full" disabled>
          <Plus /> New chat
        </Button>
        <div className="mt-2 flex items-center gap-3 rounded-lg bg-accent p-2">
          <div className="w-16 shrink-0 overflow-hidden rounded-md">
            <Thumb sb={sb} />
          </div>
          <span className="line-clamp-2 text-sm">{sb.title}</span>
        </div>
      </nav>
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          <p className="max-w-md self-end rounded-2xl bg-secondary px-4 py-2">
            Show me every template in a short explainer.
          </p>
          <VideoCard sb={sb} onOpen={() => setOpen(true)} />
        </div>
        <form className="relative m-4 mt-0" onSubmit={(e) => e.preventDefault()}>
          <Textarea
            aria-label="Message"
            placeholder="Describe a video or paste a URL… (generation arrives in milestone 3)"
            className="min-h-20 resize-none rounded-2xl pr-14"
            disabled
          />
          <Button
            type="submit"
            size="icon"
            className="absolute right-3 bottom-3 rounded-full"
            aria-label="Send"
            disabled
          >
            <ArrowUp />
          </Button>
        </form>
      </main>
      {open && <Preview sb={sb} onChange={setSb} onClose={() => setOpen(false)} />}
    </div>
  )
}

export default App
