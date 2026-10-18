import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  type MotionValue,
  easeOut,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform
} from 'motion/react'
import { type Storyboard, FORMATS, duration } from '../../../shared/schema'
import { type Local, LocalCtx, useLocal } from './context'
import { Backdrop, Bar, CountUp, Grain, Hud, In, Kicker, Kinetic, Terminal } from './motion'

const Img = ({ src, className }: { src?: string; className: string }): React.JSX.Element | null =>
  src ? <img src={src} alt="" className={className} /> : null

const FONTS = {
  sans: "'Geist Variable', sans-serif",
  serif: "'Fraunces Variable', serif",
  mono: "'Geist Mono Variable', monospace"
}

const HEAD = 'font-bold leading-[1.05] tracking-[-0.035em]'

function Template(): React.JSX.Element {
  const { s, sb, step, t } = useLocal()
  const kenBurns = useTransform(t, [0, s.durationSec], ['scale(1)', 'scale(1.06)'])
  const accent = { color: sb.palette.accent }
  const center =
    'flex h-full flex-col items-center justify-center gap-[3cqmin] p-[8cqmin] text-center'
  const left = 'flex h-full flex-col justify-center gap-[3cqmin] p-[10cqmin]'
  switch (s.template) {
    case 'title':
      return (
        <div className={center}>
          <Kicker text={s.kicker} />
          <Kinetic
            text={s.headline}
            chars={s.headline.length <= 24}
            className={`text-[13cqmin] ${HEAD}`}
          />
          <Bar i={1} center className="h-[0.6cqmin] w-[18cqmin] rounded-full" />
          {s.sub && (
            <In i={2} className="text-[4.5cqmin] opacity-70">
              {s.sub}
            </In>
          )}
        </div>
      )
    case 'text':
      return (
        <div className={center}>
          <Kicker text={s.kicker} />
          <Kinetic text={s.headline} className={`text-[8.5cqmin] ${HEAD}`} />
        </div>
      )
    case 'stat':
      return (
        <div className={center}>
          <Kicker text={s.kicker} />
          <div style={accent}>
            <CountUp
              text={s.headline}
              className={`${s.headline.length > 8 ? 'text-[13cqmin]' : 'text-[24cqmin]'} font-black leading-none tracking-[-0.04em]`}
            />
          </div>
          {s.sub && <Kinetic i={1} text={s.sub} className="text-[5cqmin] opacity-70" />}
        </div>
      )
    case 'quote':
      return (
        <div className={center}>
          <Kicker text={s.kicker} />
          <In className="text-[16cqmin] leading-none font-black">
            <span style={accent}>“</span>
          </In>
          <Kinetic
            text={s.headline}
            className="-mt-[6cqmin] text-[7cqmin] leading-tight font-medium italic"
          />
          {s.sub && (
            <In i={2} className="text-[4cqmin]">
              <span style={accent}>— {s.sub}</span>
            </In>
          )}
        </div>
      )
    case 'list':
      return (
        <div className={left}>
          <Kicker text={s.kicker} />
          <Kinetic text={s.headline} className={`text-[8cqmin] ${HEAD}`} />
          {s.items?.map((item, i) => (
            <In key={i} i={i + 1} className="flex items-center gap-[2.5cqmin] text-[5.5cqmin]">
              <span
                className="h-[0.6cqmin] w-[4cqmin] rounded-full"
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
          <Kicker text={s.kicker} />
          <In className="flex items-baseline gap-[2cqmin]">
            <span
              className="text-[16cqmin] leading-none font-black tracking-[-0.05em]"
              style={accent}
            >
              {String(step).padStart(2, '0')}
            </span>
            <span className="text-[3.5cqmin] font-semibold tracking-[0.3em] uppercase opacity-60">
              Step
            </span>
          </In>
          <Kinetic i={1} text={s.headline} className={`text-[9cqmin] ${HEAD}`} />
          {s.sub && (
            <In i={2} className="text-[4.5cqmin] opacity-70">
              {s.sub}
            </In>
          )}
        </div>
      )
    case 'code':
      return (
        <div className={center}>
          <Terminal title={s.headline} lines={s.items ?? []} />
        </div>
      )
    case 'screenshot':
      return (
        <div className={center}>
          <Kicker text={s.kicker} />
          <Kinetic text={s.headline} className={`text-[6cqmin] ${HEAD}`} />
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
          <Kinetic i={1} text={s.headline} chars className={`text-[8cqmin] ${HEAD}`} />
        </div>
      )
    case 'cta':
      return (
        <div className={center}>
          <Kicker text={s.kicker} />
          <Kinetic text={s.headline} className={`text-[10cqmin] ${HEAD}`} />
          {s.sub && (
            <In i={1} className="pt-[2cqmin] text-[4.5cqmin] font-semibold">
              <span
                className="rounded-full px-[5cqmin] py-[2cqmin]"
                style={{
                  background: sb.palette.accent,
                  color: sb.palette.bg,
                  boxShadow: `0 0 6cqmin -1cqmin ${sb.palette.accent}`
                }}
              >
                {s.sub}
              </span>
            </In>
          )}
        </div>
      )
    default: // feature; shortcut: 'custom' renders as feature until AI scenes land in milestone 7
      return (
        <div className={left}>
          <Kicker text={s.kicker} />
          <Bar className="h-[0.8cqmin] w-[14cqmin] rounded-full" />
          <Kinetic i={1} text={s.headline} className={`text-[10cqmin] ${HEAD}`} />
          {s.sub && (
            <In i={2} className="text-[5cqmin] opacity-70">
              {s.sub}
            </In>
          )}
        </div>
      )
  }
}

function SceneView({ start, ...rest }: Omit<Local, 't'> & { start: number }): React.JSX.Element {
  const t = useTransform(rest.time, (v) => v - start)
  // full-bleed color flip: the scene repaints the palette and everything inside follows it
  const { bg, fg, accent } = rest.sb.palette
  const flip = rest.s.bg ?? 'base'
  const palette =
    flip === 'accent'
      ? { bg: accent, fg: bg, accent: bg }
      : flip === 'inverse'
        ? { bg: fg, fg: bg, accent }
        : rest.sb.palette
  const sb = { ...rest.sb, palette }
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
  // slow camera push across the whole scene
  const push = useTransform(
    t,
    (v) => `scale(${1 + 0.035 * Math.min(1, Math.max(0, v / rest.s.durationSec))})`
  )
  return (
    <LocalCtx.Provider value={{ ...rest, sb, t }}>
      <motion.div
        className="absolute inset-0"
        style={{
          opacity,
          transform,
          clipPath,
          color: palette.fg,
          background: flip === 'base' ? undefined : palette.bg
        }}
      >
        <motion.div className="h-full" style={{ transform: push }}>
          <Template />
        </motion.div>
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
        color: sb.palette.fg,
        fontFamily: FONTS[sb.font ?? 'sans']
      }}
    >
      <Backdrop sb={sb} time={time} />
      <SceneView
        key={`${index}-${sb.tone}`}
        time={time}
        start={start}
        s={sb.scenes[index]}
        sb={sb}
        step={step}
      />
      <Grain time={time} />
      {sb.hud && <Hud sb={sb} time={time} total={duration(sb)} />}
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
