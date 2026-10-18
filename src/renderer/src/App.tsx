import { useState } from 'react'
import { useMotionValue } from 'motion/react'
import { ArrowUp, FileText, Film, Paperclip, Plus, X } from 'lucide-react'
import { Player } from './player/Player'
import { Preview } from './Preview'
import { Chip } from './components/Chip'
import { Loader } from './components/Loader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  GenerateRequest as Request,
  type Attachment,
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
  const [opts, setOpts] = useState<Omit<GenerateRequest, 'text' | 'attachments'>>({
    kind: 'launch',
    tone: 'default',
    format: 'landscape',
    duration: 20,
    music: true
  })
  const [text, setText] = useState('')
  const [atts, setAtts] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  const latest = msgs.findLast((m) => m.role === 'assistant')
  const opened = open === null ? undefined : msgs[open]

  const fail = (e: unknown): void =>
    setMsgs((m) => [
      ...m,
      {
        role: 'error',
        text: String(e).replace(/^Error: Error invoking remote method '\w+': (Error: )?/, '')
      }
    ])
  const added = (list: Attachment[]): void =>
    setAtts((a) => [...a, ...list.filter((x) => !a.some((y) => y.id === x.id))].slice(0, 10))

  // Dropped/pasted files: send the real path when there is one, raw bytes for pasted screenshots.
  const addFiles = async (files: File[]): Promise<void> => {
    for (const f of files) {
      const path = window.api.pathForFile(f)
      try {
        added([
          await window.electron.ipcRenderer.invoke(
            'attach',
            path
              ? { name: f.name, path }
              : { name: f.name || 'pasted.png', data: new Uint8Array(await f.arrayBuffer()) }
          )
        ])
      } catch (e) {
        fail(e)
      }
    }
  }
  const pick = async (): Promise<void> => {
    const res: PromiseSettledResult<Attachment>[] =
      await window.electron.ipcRenderer.invoke('pickFiles')
    added(res.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])))
    res.forEach((r) => r.status === 'rejected' && fail(r.reason))
  }

  const send = async (): Promise<void> => {
    const t = text.trim()
    if (!t || busy) return
    const files = atts.length ? `\n📎 ${atts.map((a) => a.name).join(', ')}` : ''
    setMsgs((m) => [...m, { role: 'user', text: t + files }])
    setText('')
    setAtts([])
    setBusy(true)
    try {
      const sb: Storyboard = await window.electron.ipcRenderer.invoke('generate', {
        ...opts,
        text: t,
        attachments: atts.map((a) => a.id)
      })
      setMsgs((m) => [...m, { role: 'assistant', sb }])
    } catch (e) {
      fail(e)
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
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => (e.preventDefault(), addFiles([...e.dataTransfer.files]))}
        >
          {atts.length > 0 && (
            <ul className="flex flex-wrap gap-2 px-1 pt-1" aria-label="Attachments">
              {atts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 rounded-lg bg-secondary py-1 pr-1 pl-1 text-sm"
                >
                  {a.kind === 'image' ? (
                    <img src={a.url} alt="" className="size-8 rounded object-cover" />
                  ) : (
                    <span className="grid size-8 place-items-center rounded bg-background text-muted-foreground">
                      {a.kind === 'video' ? (
                        <Film className="size-4" />
                      ) : (
                        <FileText className="size-4" />
                      )}
                    </span>
                  )}
                  <span className="max-w-40 truncate" title={a.info}>
                    {a.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label={`Remove ${a.name}`}
                    onClick={() => setAtts((l) => l.filter((x) => x.id !== a.id))}
                  >
                    <X className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Textarea
            aria-label="Message"
            placeholder="Describe a video…"
            className="min-h-16 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            onPaste={(e) => {
              if (e.clipboardData.files.length) {
                e.preventDefault()
                addFiles([...e.clipboardData.files])
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Attach images, video or documents"
              onClick={pick}
            >
              <Paperclip />
            </Button>
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
