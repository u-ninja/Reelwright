import { useState } from 'react'
import { useMotionValue } from 'motion/react'
import { ArrowUp, Plus } from 'lucide-react'
import { Player } from './player/Player'
import { Preview } from './Preview'
import { Chip } from './components/Chip'
import { Loader } from './components/Loader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  GenerateRequest as Request,
  type GenerateRequest,
  type Storyboard,
  Storyboard as Schema,
  duration
} from '../../shared/schema'

type Msg = { role: 'user' | 'error'; text: string } | { role: 'assistant'; sb: Storyboard }
const LENGTHS = ['10', '20', '30', '45', '60'] as const
const VOICES = ['off', ...Request.shape.voice.unwrap().options] as const

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
  // shortcut: one chat kept in memory; saved chats, memory and follow-up edits arrive in milestone 8.
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [opts, setOpts] = useState<Omit<GenerateRequest, 'text'>>({
    kind: 'launch',
    tone: 'default',
    format: 'landscape',
    duration: 20,
    music: true
  })
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  const latest = msgs.findLast((m) => m.role === 'assistant')
  const opened = open === null ? undefined : msgs[open]

  const send = async (): Promise<void> => {
    const t = text.trim()
    if (!t || busy) return
    setMsgs((m) => [...m, { role: 'user', text: t }])
    setText('')
    setBusy(true)
    try {
      const sb: Storyboard = await window.electron.ipcRenderer.invoke('generate', {
        ...opts,
        text: t
      })
      setMsgs((m) => [...m, { role: 'assistant', sb }])
    } catch (e) {
      setMsgs((m) => [
        ...m,
        {
          role: 'error',
          text: String(e).replace(/^Error: Error invoking remote method 'generate': /, '')
        }
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-screen">
      <nav className="flex w-64 shrink-0 flex-col gap-2 border-r p-3">
        <div className="px-2 py-1 text-lg font-bold tracking-tight">Reelwright</div>
        <Button variant="secondary" className="justify-start rounded-full" disabled>
          <Plus /> New chat
        </Button>
        <div className="mt-2 flex items-center gap-3 rounded-lg bg-accent p-2">
          <div className="aspect-video w-16 shrink-0 overflow-hidden rounded-md bg-background">
            {latest?.role === 'assistant' && <Thumb sb={latest.sb} />}
          </div>
          <span className="line-clamp-2 text-sm">
            {latest?.role === 'assistant' ? latest.sb.title : 'New chat'}
          </span>
        </div>
      </nav>
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          {!msgs.length && (
            <p className="m-auto max-w-sm text-center text-muted-foreground">
              Describe the video you want: what it&apos;s about, who it&apos;s for, and any facts or
              numbers it should use.
            </p>
          )}
          {msgs.map((m, i) =>
            m.role === 'assistant' ? (
              <VideoCard key={i} sb={m.sb} onOpen={() => setOpen(i)} />
            ) : (
              <p
                key={i}
                className={
                  m.role === 'user'
                    ? 'max-w-md self-end rounded-2xl bg-secondary px-4 py-2 whitespace-pre-wrap'
                    : 'max-w-md text-sm text-destructive'
                }
              >
                {m.text}
              </p>
            )
          )}
          {busy && (
            <p className="flex items-center gap-3 text-muted-foreground">
              <Loader label="Writing storyboard" className="text-primary" />
              {opts.voice
                ? 'Writing the storyboard and recording the voice…'
                : 'Writing the storyboard…'}
            </p>
          )}
        </div>
        <form
          className="m-4 mt-0 flex flex-col gap-2 rounded-2xl border bg-card p-2"
          onSubmit={(e) => (e.preventDefault(), send())}
        >
          <Textarea
            aria-label="Message"
            placeholder="Describe a video…"
            className="min-h-16 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Chip
              label="Kind"
              value={opts.kind}
              options={Schema.shape.kind.options}
              onChange={(kind) => setOpts({ ...opts, kind })}
            />
            <Chip
              label="Tone"
              value={opts.tone}
              options={Schema.shape.tone.options}
              onChange={(tone) => setOpts({ ...opts, tone })}
            />
            <Chip
              label="Format"
              value={opts.format}
              options={Schema.shape.format.options}
              onChange={(format) => setOpts({ ...opts, format })}
            />
            <Chip
              label="Length"
              value={String(opts.duration) as (typeof LENGTHS)[number]}
              options={LENGTHS}
              format={(o) => `${o}s`}
              onChange={(d) => setOpts({ ...opts, duration: +d })}
            />
            <Chip
              label="Voice"
              value={opts.voice ?? 'off'}
              options={VOICES}
              format={(o) => (o === 'off' ? 'no voice' : `voice: ${o.split('_')[1]}`)}
              onChange={(v) => setOpts({ ...opts, voice: v === 'off' ? undefined : v })}
            />
            <Chip
              label="Music"
              value={opts.music ? 'music' : 'no music'}
              options={['music', 'no music'] as const}
              onChange={(v) => setOpts({ ...opts, music: v === 'music' })}
            />
            <Button
              type="submit"
              size="icon"
              className="ml-auto rounded-full"
              aria-label="Send"
              disabled={busy || !text.trim()}
            >
              <ArrowUp />
            </Button>
          </div>
        </form>
      </main>
      {opened?.role === 'assistant' && (
        <Preview
          key={open}
          sb={opened.sb}
          onChange={(sb) =>
            setMsgs((m) => m.map((x, i) => (i === open ? { role: 'assistant', sb } : x)))
          }
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}

export default App
