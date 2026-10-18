import { useEffect, useRef, useState } from 'react'
import { useMotionValue, useMotionValueEvent } from 'motion/react'
import { Pause, Play, X } from 'lucide-react'
import { Player } from './player/Player'
import { Loader } from './components/Loader'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Chip } from './components/Chip'
import { type Storyboard, duration, sceneStarts, Storyboard as Schema } from '../../shared/schema'

const clock = (s: number): string =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function Preview({
  sb,
  onChange,
  onClose
}: {
  sb: Storyboard
  onChange: (sb: Storyboard) => void
  onClose: () => void
}): React.JSX.Element {
  const time = useMotionValue(0)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [status, setStatus] = useState('')
  useMotionValueEvent(time, 'change', setT)
  const total = duration(sb)
  const starts = sceneStarts(sb)
  const audio = useRef<HTMLAudioElement>(null)
  const [src, setSrc] = useState<string>()

  // The same mixed soundtrack the render uses (voice + ducked music), as a blob URL.
  useEffect(() => {
    let url: string | undefined
    let alive = true
    window.electron.ipcRenderer
      .invoke('soundtrack', sb)
      .then((d: Uint8Array<ArrayBuffer> | null) => {
        if (alive && d) setSrc((url = URL.createObjectURL(new Blob([d], { type: 'audio/mp4' }))))
      })
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [sb])

  useEffect(() => {
    if (!playing) return
    if (time.get() >= total) time.set(0)
    const a = audio.current
    if (a && src) {
      a.currentTime = time.get()
      void a.play()
    }
    let last = performance.now()
    let id = requestAnimationFrame(function tick(now) {
      const next = Math.min(total, time.get() + (now - last) / 1000)
      last = now
      time.set(next)
      if (next < total) id = requestAnimationFrame(tick)
      else setPlaying(false)
    })
    return () => {
      cancelAnimationFrame(id)
      a?.pause()
    }
  }, [playing, total, time, src])

  const render = async (): Promise<void> => {
    setStatus('Rendering…')
    try {
      setStatus(`Saved ${await window.electron.ipcRenderer.invoke('render', sb)}`)
    } catch (e) {
      setStatus(String(e))
    }
  }

  return (
    <aside className="flex w-[440px] shrink-0 flex-col gap-4 overflow-y-auto border-l p-4">
      <div className="flex items-center justify-between">
        <h2 className="truncate font-semibold">{sb.title}</h2>
        <Button variant="ghost" size="icon" aria-label="Close preview" onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="flex max-h-[60vh] shrink-0 justify-center overflow-hidden rounded-xl bg-black">
        <div
          style={{
            width: sb.format === 'landscape' ? '100%' : sb.format === 'square' ? '75%' : '45%'
          }}
        >
          <Player sb={sb} time={time} />
          <audio ref={audio} src={src} preload="auto" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          className="rounded-full"
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? <Pause /> : <Play />}
        </Button>
        <Slider
          aria-label="Time"
          min={0}
          max={total}
          step={1 / 30}
          value={[t]}
          onValueChange={([v]) => (setPlaying(false), time.set(v))}
        />
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {clock(t)} / {clock(total)}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip
          label="Tone"
          value={sb.tone}
          options={Schema.shape.tone.options}
          onChange={(tone) => onChange({ ...sb, tone })}
        />
        <Chip
          label="Format"
          value={sb.format}
          options={Schema.shape.format.options}
          onChange={(format) => onChange({ ...sb, format })}
        />
      </div>
      <p className="text-sm text-muted-foreground">{sb.shareCopy}</p>
      <ol className="flex flex-col gap-1">
        {sb.scenes.map((s, i) => {
          const active =
            t >= starts[i] && (t < starts[i] + s.durationSec || i === sb.scenes.length - 1)
          return (
            <li key={i}>
              <button
                className={
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent ' +
                  (active ? 'bg-accent' : '')
                }
                onClick={() => (setPlaying(false), time.set(starts[i]))}
              >
                <span className="w-20 shrink-0 text-xs text-muted-foreground">{s.template}</span>
                <span className="flex-1 truncate">{s.headline}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{s.durationSec}s</span>
              </button>
            </li>
          )
        })}
      </ol>
      <Button className="rounded-full" onClick={render} disabled={status === 'Rendering…'}>
        {status === 'Rendering…' ? <Loader label="Rendering" /> : null}
        {status === 'Rendering…' ? 'Rendering…' : 'Render MP4'}
      </Button>
      <p className="break-all text-xs text-muted-foreground" aria-live="polite">
        {status !== 'Rendering…' && status}
      </p>
    </aside>
  )
}
