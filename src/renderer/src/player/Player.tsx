import { createContext, useContext, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  type EasingFunction,
  type MotionValue,
  anticipate,
  backOut,
  easeInOut,
  easeOut,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform
} from 'motion/react'
import { type Scene, type Storyboard, FORMATS } from '../../../shared/schema'

// Tone = how things move: entrance length (s), stagger between elements (s), easing.
const TONES: Record<Storyboard['tone'], { enter: number; stagger: number; ease: EasingFunction }> =
  {
    default: { enter: 0.6, stagger: 0.12, ease: easeOut },
    polished: { enter: 0.8, stagger: 0.15, ease: easeInOut },
    'yc-parody': { enter: 0.4, stagger: 0.08, ease: backOut },
    chaotic: { enter: 0.25, stagger: 0.05, ease: anticipate },
    deadpan: { enter: 0.01, stagger: 0, ease: easeOut },
    cinematic: { enter: 1.2, stagger: 0.3, ease: easeInOut },
    'app-store': { enter: 0.5, stagger: 0.1, ease: backOut }
  }

type Local = { t: MotionValue<number>; s: Scene; sb: Storyboard; step: number }
const LocalCtx = createContext<Local>(null!)

// Staggered entrance + shared exit. Everything derives from t (seconds into the scene),
// never from Motion's own clock, so a seek fully determines the frame.
function In({
  i = 0,
  className,
  children
}: {
  i?: number
  className?: string
  children: React.ReactNode
}): React.JSX.Element {
  const { t, s, sb } = useContext(LocalCtx)
  const tone = TONES[sb.tone]
  const start = i * tone.stagger
  const p = useTransform(t, [start, start + tone.enter], [0, 1], { ease: tone.ease })
  const opacity = useTransform(() =>
    Math.min(p.get(), Math.min(1, (s.durationSec - t.get()) / 0.3))
  )
  const transform = useTransform(p, (v) => `translateY(${(1 - v) * 4}cqmin)`)
  return (
    <motion.div className={className} style={{ opacity, transform }}>
      {children}
    </motion.div>
  )
}

const Img = ({ src, className }: { src?: string; className: string }): React.JSX.Element | null =>
  src ? <img src={src} alt="" className={className} /> : null

function Template(): React.JSX.Element {
  const { s, sb, step, t } = useContext(LocalCtx)
  const kenBurns = useTransform(t, [0, s.durationSec], ['scale(1)', 'scale(1.06)'])
  const accent = { color: sb.palette.accent }
  const center =
    'flex h-full flex-col items-center justify-center gap-[3cqmin] p-[8cqmin] text-center'
  const left = 'flex h-full flex-col justify-center gap-[3cqmin] p-[10cqmin]'
  switch (s.template) {
    case 'title':
      return (
        <div className={center}>
          <In className="text-[12cqmin] font-bold leading-none tracking-tight">{s.headline}</In>
          <In i={1} className="text-[4.5cqmin] opacity-70">
            {s.sub}
          </In>
        </div>
      )
    case 'text':
      return (
        <div className={center}>
          <In className="text-[8cqmin] font-semibold leading-tight">{s.headline}</In>
        </div>
      )
    case 'stat':
      return (
        <div className={center}>
          <In className="text-[22cqmin] font-black leading-none">
            <span style={accent}>{s.headline}</span>
          </In>
          <In i={1} className="text-[5cqmin] opacity-70">
            {s.sub}
          </In>
        </div>
      )
    case 'quote':
      return (
        <div className={center}>
          <In className="text-[7cqmin] font-medium italic leading-tight">“{s.headline}”</In>
          <In i={1} className="text-[4cqmin]">
            <span style={accent}>— {s.sub}</span>
          </In>
        </div>
      )
    case 'list':
      return (
        <div className={left}>
          <In className="text-[8cqmin] font-bold">{s.headline}</In>
          {s.items?.map((item, i) => (
            <In key={item} i={i + 1} className="flex items-center gap-[2cqmin] text-[5.5cqmin]">
              <span
                className="size-[1.6cqmin] rounded-full"
                style={{ background: sb.palette.accent }}
              />
              {item}
            </In>
          ))}
        </div>
      )
    case 'step':
      return (
        <div className={left}>
          <In className="text-[5cqmin] font-semibold uppercase tracking-widest">
            <span style={accent}>Step {step}</span>
          </In>
          <In i={1} className="text-[9cqmin] font-bold leading-tight">
            {s.headline}
          </In>
          <In i={2} className="text-[4.5cqmin] opacity-70">
            {s.sub}
          </In>
        </div>
      )
    case 'screenshot':
      return (
        <div className={center}>
          <In className="text-[6cqmin] font-bold">{s.headline}</In>
          <In i={1} className="min-h-0 overflow-hidden rounded-[2cqmin] shadow-2xl">
            <motion.div style={{ transform: kenBurns }}>
              <Img src={s.asset} className="max-h-[55cqh] max-w-[80cqw]" />
            </motion.div>
          </In>
        </div>
      )
    case 'logo':
      return (
        <div className={center}>
          <In>
            <Img src={s.asset} className="size-[28cqmin] object-contain" />
          </In>
          <In i={1} className="text-[8cqmin] font-bold">
            {s.headline}
          </In>
        </div>
      )
    case 'cta':
      return (
        <div className={center}>
          <In className="text-[9cqmin] font-bold leading-tight">{s.headline}</In>
          <In i={1} className="pt-[2cqmin] text-[4.5cqmin] font-semibold">
            <span
              className="rounded-full px-[5cqmin] py-[2cqmin]"
              style={{ background: sb.palette.accent, color: sb.palette.bg }}
            >
              {s.sub}
            </span>
          </In>
        </div>
      )
    default: // feature; shortcut: 'custom' renders as feature until AI scenes land in milestone 7
      return (
        <div className={left}>
          <In>
            <div
              className="h-[1cqmin] w-[14cqmin] rounded-full"
              style={{ background: sb.palette.accent }}
            />
          </In>
          <In i={1} className="text-[10cqmin] font-bold leading-tight">
            {s.headline}
          </In>
          <In i={2} className="text-[5cqmin] opacity-70">
            {s.sub}
          </In>
        </div>
      )
  }
}

function SceneView({
  time,
  start,
  ...rest
}: Omit<Local, 't'> & { time: MotionValue<number>; start: number }): React.JSX.Element {
  const t = useTransform(time, (v) => v - start)
  const p = useTransform(t, [0, 0.5], [0, 1], { ease: easeOut })
  const kind = rest.s.transitionIn
  const opacity = useTransform(p, (v) => (kind === 'fade' || kind === 'zoom' ? v : 1))
  const transform = useTransform(p, (v) =>
    kind === 'slide'
      ? `translateX(${(1 - v) * 100}%)`
      : kind === 'zoom'
        ? `scale(${1.15 - 0.15 * v})`
        : 'none'
  )
  const clipPath = useTransform(p, (v) =>
    kind === 'wipe' ? `inset(0 ${(1 - v) * 100}% 0 0)` : 'none'
  )
  return (
    <LocalCtx.Provider value={{ ...rest, t }}>
      <motion.div className="absolute inset-0" style={{ opacity, transform, clipPath }}>
        <Template />
      </motion.div>
    </LocalCtx.Provider>
  )
}

const sceneAt = (sb: Storyboard, t: number): number => {
  let start = 0
  let i = 0
  while (i < sb.scenes.length - 1 && t >= start + sb.scenes[i].durationSec)
    start += sb.scenes[i++].durationSec
  return i
}

export function Player({
  sb,
  time,
  className
}: {
  sb: Storyboard
  time: MotionValue<number>
  className?: string
}): React.JSX.Element {
  const [i, setI] = useState(() => sceneAt(sb, time.get()))
  useMotionValueEvent(time, 'change', (v) => setI(sceneAt(sb, v)))
  const index = Math.min(i, sb.scenes.length - 1)
  const start = sb.scenes.slice(0, index).reduce((a, s) => a + s.durationSec, 0)
  const step = sb.scenes.slice(0, index + 1).filter((s) => s.template === 'step').length
  const [w, h] = FORMATS[sb.format]
  return (
    <div
      className={'relative w-full overflow-hidden ' + (className ?? '')}
      style={{
        aspectRatio: `${w} / ${h}`,
        containerType: 'size',
        background: sb.palette.bg,
        color: sb.palette.fg
      }}
    >
      <SceneView
        key={`${index}-${sb.tone}`}
        time={time}
        start={start}
        s={sb.scenes[index]}
        sb={sb}
        step={step}
      />
    </div>
  )
}

declare global {
  interface Window {
    __load: (sb: Storyboard) => void
    __seek: (t: number) => Promise<void>
  }
}

// Mounted in the offscreen render window: main calls __load(sb), then __seek(t) + capture per frame.
export function RenderRoot(): React.JSX.Element | null {
  const time = useMotionValue(0)
  const [sb, setSb] = useState<Storyboard>()
  useEffect(() => {
    window.__load = (next) => flushSync(() => setSb(next))
    window.__seek = async (t) => {
      flushSync(() => time.set(t))
      await document.fonts.ready
      await Promise.all([...document.images].map((img) => img.decode().catch(() => {})))
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    }
  }, [time])
  return sb ? <Player sb={sb} time={time} /> : null
}
