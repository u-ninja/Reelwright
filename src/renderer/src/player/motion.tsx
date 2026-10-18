import { Fragment } from 'react'
import { type MotionValue, easeOut, motion, useTransform } from 'motion/react'
import { type Storyboard, FORMATS } from '../../../shared/schema'
import { blockStart, useEnter, useExit, useLocal } from './context'
import { type Word, countable, parseMarkup, plainText } from './markup'

// One word or letter of kinetic text.
function Unit({
  text,
  delay,
  odd
}: {
  text: string
  delay: number
  odd: boolean
}): React.JSX.Element {
  const { tone } = useLocal()
  const p = useEnter(delay)
  const x = useExit()
  const transform = useTransform(() => {
    const v = p.get()
    const e = x.get()
    if (tone.style === 'rise') return `translateY(${(1 - v) * 105 - e * 105}%)`
    if (tone.style === 'punch')
      return `scale(${1 + (1 - v) * 0.7}) rotate(${(1 - v) * (odd ? 7 : -7)}deg) translateY(${-e * 40}%)`
    if (tone.style === 'blur') return `translateY(${(1 - v) * 25 - e * 25}%)`
    return 'none'
  })
  const filter = useTransform(() =>
    tone.style === 'blur' ? `blur(${Math.max(0, 1 - p.get() + x.get()) * 0.18}em)` : 'none'
  )
  const opacity = useTransform(() =>
    tone.style === 'rise' ? 1 : Math.min(1, p.get() * 1.6) * (1 - x.get())
  )
  return (
    // rise reveals through a mask; the padding keeps descenders from being clipped
    <span
      className={
        tone.style === 'rise'
          ? '-mb-[0.12em] inline-block overflow-hidden pb-[0.12em] align-bottom'
          : 'inline-block'
      }
    >
      <motion.span className="inline-block" style={{ transform, filter, opacity }}>
        {text}
      </motion.span>
    </span>
  )
}

// Highlight box that wipes on behind its words, then the words land on it.
function Highlight({
  delay,
  children
}: {
  delay: number
  children: React.ReactNode
}): React.JSX.Element {
  const { sb, tone } = useLocal()
  const p = useEnter(delay, Math.max(0.3, tone.enter * 0.6))
  const x = useExit()
  const transform = useTransform(() => `scaleX(${Math.max(0, Math.min(1, p.get()) - x.get())})`)
  return (
    <span className="relative inline-block px-[0.12em]" style={{ color: sb.palette.bg }}>
      <motion.span
        className="absolute inset-0 origin-left -skew-x-6"
        style={{ transform, background: sb.palette.accent }}
      />
      <span className="relative">{children}</span>
    </span>
  )
}

// Text that animates in word by word (or letter by letter), styled by the tone, with markup.
export function Kinetic({
  text,
  i = 0,
  chars = false,
  className
}: {
  text: string
  i?: number
  chars?: boolean
  className?: string
}): React.JSX.Element {
  const { tone, s, sb } = useLocal()
  const start = blockStart(i, tone.enter)
  const lines = text.split('\n').length
  const units = chars ? plainText(text).replace(/ /g, '').length : plainText(text).split(' ').length
  // the last word or letter starts by a quarter of the scene (half when lines build in)
  const gap = Math.min(tone.stagger * (chars ? 0.35 : 1), (s.durationSec * 0.25) / units)
  const lineGap = lines > 1 ? Math.min(0.55, (s.durationSec * 0.35) / lines) : 0
  const parsed = parseMarkup(text, start, chars ? 0 : gap, lineGap)
  const word = (w: Word, k: number): React.JSX.Element => (
    <span
      key={k}
      className={'inline-block whitespace-nowrap' + (w.mark === 'accent' ? ' italic' : '')}
      style={w.mark === 'accent' ? { color: sb.palette.accent } : undefined}
    >
      {(chars ? [...w.text] : [w.text]).map((c, j) => (
        <Unit key={j} text={c} delay={w.delay + j * gap} odd={(k + j) % 2 === 1} />
      ))}
    </span>
  )
  return (
    <div className={className} aria-label={plainText(text)}>
      {parsed.map((line, li) => (
        <div key={li} aria-hidden>
          {line.map((w, k) => {
            const prev = line[k - 1]
            const space = k > 0 ? ' ' : ''
            // a highlight run is drawn once, around all of its words
            if (w.mark === 'highlight') {
              if (prev?.seg === w.seg) return null
              const run = line.filter((x) => x.seg === w.seg)
              return (
                <Fragment key={k}>
                  {space}
                  <Highlight delay={w.delay}>
                    {run.map((r, j) => (
                      <Fragment key={j}>
                        {j > 0 && ' '}
                        {word(r, j)}
                      </Fragment>
                    ))}
                  </Highlight>
                </Fragment>
              )
            }
            return (
              <Fragment key={k}>
                {space}
                {word(w, k)}
              </Fragment>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// Small mono uppercase label above a headline.
export function Kicker({ text }: { text?: string }): React.JSX.Element | null {
  const { sb } = useLocal()
  if (!text) return null
  return (
    <In className="font-mono text-[2.4cqmin] tracking-[0.25em] uppercase">
      <span style={{ color: sb.palette.accent }}>{text}</span>
    </In>
  )
}

// A block (sub line, image, pill) that enters as one piece, matching the tone.
export function In({
  i = 0,
  className,
  children
}: {
  i?: number
  className?: string
  children: React.ReactNode
}): React.JSX.Element {
  const { tone } = useLocal()
  const p = useEnter(blockStart(i, tone.enter))
  const x = useExit()
  const opacity = useTransform(() => Math.min(1, p.get() * 1.4) * (1 - x.get()))
  const transform = useTransform(() =>
    tone.style === 'punch'
      ? `scale(${0.85 + 0.15 * p.get()}) translateY(${-x.get() * 3}cqmin)`
      : `translateY(${(1 - p.get()) * 3 - x.get() * 2}cqmin)`
  )
  const filter = useTransform(() =>
    tone.style === 'blur' ? `blur(${Math.max(0, 1 - p.get() + x.get()) * 1.2}cqmin)` : 'none'
  )
  return (
    <motion.div className={className} style={{ opacity, transform, filter }}>
      {children}
    </motion.div>
  )
}

// Accent line that draws itself on from the left (or from the center).
export function Bar({
  i = 0,
  center = false,
  className
}: {
  i?: number
  center?: boolean
  className?: string
}): React.JSX.Element {
  const { sb, tone } = useLocal()
  const p = useEnter(blockStart(i, tone.enter), Math.max(0.4, tone.enter))
  const x = useExit()
  const transform = useTransform(() => `scaleX(${Math.max(0, Math.min(1, p.get()) - x.get())})`)
  return (
    <motion.div
      className={className}
      style={{
        transform,
        transformOrigin: center ? 'center' : 'left',
        background: sb.palette.accent
      }}
    />
  )
}

// "1,200 teams" counts up from 0 as it enters; text without a leading number falls back to kinetic text.
export function CountUp({
  text,
  className
}: {
  text: string
  className?: string
}): React.JSX.Element {
  const { t } = useLocal()
  const m = countable(text)
  const num = m?.[1] ?? '0'
  const target = parseFloat(num.replace(/,/g, ''))
  const decimals = (num.split('.')[1] ?? '').length
  const shown = useTransform(t, [0.1, 1.3], [0, target], { ease: easeOut })
  const label = useTransform(shown, (v) =>
    v.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: num.includes(',')
    })
  )
  if (!m) return <Kinetic text={text} className={className} />
  return (
    <In className={className}>
      {m[0]}
      <motion.span className="tabular-nums">{label}</motion.span>
      {m[2]}
    </In>
  )
}

// Terminal window that types its lines out, sped up so it always finishes before the scene ends.
export function Terminal({ title, lines }: { title: string; lines: string[] }): React.JSX.Element {
  const { s, sb } = useLocal()
  const total = lines.join('').length
  const cps = Math.max(28, total / Math.max(0.5, s.durationSec - 1.4))
  const starts = lines.map((_, k) =>
    lines.slice(0, k).reduce((a, l) => a + l.length / cps + 0.25, 0.5)
  )
  return (
    <In className="w-[min(86cqw,150cqh)] overflow-hidden rounded-[1.6cqmin] border border-white/15 bg-black/70 text-left shadow-2xl backdrop-blur">
      <div className="flex items-center gap-[1cqmin] border-b border-white/10 px-[2cqmin] py-[1.4cqmin]">
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <span key={c} className="size-[1.4cqmin] rounded-full" style={{ background: c }} />
        ))}
        <span className="ml-[1.5cqmin] text-[2.2cqmin] text-white/50">{title}</span>
        <CopyBadge
          at={
            lines.length
              ? starts[lines.length - 1] + lines[lines.length - 1].length / cps + 0.35
              : 0
          }
        />
      </div>
      <div className="flex flex-col gap-[1cqmin] p-[3cqmin] font-mono text-[3.4cqmin] leading-snug text-white">
        {lines.map((line, k) => {
          return (
            <Typed
              key={k}
              text={line}
              start={starts[k]}
              cps={cps}
              accent={sb.palette.accent}
              last={k === lines.length - 1}
            />
          )
        })}
      </div>
    </In>
  )
}

// "COPY" flips to "COPIED" once the last line has finished typing.
function CopyBadge({ at }: { at: number }): React.JSX.Element {
  const { t, sb } = useLocal()
  const label = useTransform(t, (v): string => (v >= at ? 'COPIED' : 'COPY'))
  const background = useTransform(t, (v) =>
    v >= at ? sb.palette.accent : 'rgba(255,255,255,0.08)'
  )
  const color = useTransform(t, (v) => (v >= at ? sb.palette.bg : 'rgba(255,255,255,0.5)'))
  return (
    <motion.span
      className="ml-auto rounded-[0.5cqmin] px-[1.2cqmin] py-[0.4cqmin] font-mono text-[1.8cqmin] tracking-widest"
      style={{ background, color }}
    >
      {label}
    </motion.span>
  )
}

function Typed({
  text,
  start,
  cps,
  accent,
  last
}: {
  text: string
  start: number
  cps: number
  accent: string
  last: boolean
}): React.JSX.Element {
  const { t } = useLocal()
  const prompt = text.startsWith('$ ')
  const body = prompt ? text.slice(2) : text
  const shown = useTransform(t, (v) => body.slice(0, Math.max(0, Math.floor((v - start) * cps))))
  // cursor blinks on the line being typed, and stays on the last line once done
  const cursor = useTransform(t, (v) => {
    const typed = (v - start) * cps
    return typed >= 0 && (typed < body.length || last) && Math.floor(v * 2.5) % 2 === 0 ? 1 : 0
  })
  return (
    <div className="min-h-[1.3em] whitespace-pre-wrap break-all">
      {prompt && <span style={{ color: accent }}>$ </span>}
      <motion.span>{shown}</motion.span>
      <motion.span
        className="inline-block h-[1em] w-[0.55em] translate-y-[0.15em]"
        style={{ opacity: cursor, background: accent }}
      />
    </div>
  )
}

const GRAIN =
  'url("data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>'
  ) +
  '")'

// Living background behind every scene: drifting glows in the palette colors.
// Driven by video time, so it flows continuously across scene cuts.
export function Backdrop({
  sb,
  time
}: {
  sb: Storyboard
  time: MotionValue<number>
}): React.JSX.Element {
  const a = useTransform(
    time,
    (v) => `translate(${Math.sin(v * 0.35) * 14}%, ${Math.cos(v * 0.27) * 10}%)`
  )
  const b = useTransform(
    time,
    (v) => `translate(${Math.cos(v * 0.3) * 16}%, ${Math.sin(v * 0.22) * 12}%)`
  )
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -top-[30cqh] -left-[20cqw] size-[90cqmax] rounded-full opacity-25 blur-[10cqmin]"
        style={{
          background: `radial-gradient(circle, ${sb.palette.accent}, transparent 65%)`,
          transform: a
        }}
      />
      <motion.div
        className="absolute -right-[25cqw] -bottom-[35cqh] size-[80cqmax] rounded-full opacity-10 blur-[12cqmin]"
        style={{
          background: `radial-gradient(circle, ${sb.palette.fg}, transparent 65%)`,
          transform: b
        }}
      />
    </div>
  )
}

// Film grain + vignette on top of everything, so color-flip scenes get it too.
export function Grain({ time }: { time: MotionValue<number> }): React.JSX.Element {
  const grain = useTransform(time, (v) => {
    const f = Math.floor(v * 12)
    return `${(f * 37) % 100}% ${(f * 61) % 100}%`
  })
  return (
    <div className="pointer-events-none absolute inset-0">
      <motion.div
        className="absolute inset-0 opacity-[0.08] mix-blend-overlay"
        style={{ backgroundImage: GRAIN, backgroundPosition: grain }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(0,0,0,0.22))]" />
    </div>
  )
}

const clock = (v: number): string =>
  `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(Math.floor(v % 60)).padStart(2, '0')}`

// Camera-style frame: blinking REC, running timecode, format label.
export function Hud({
  sb,
  time,
  total
}: {
  sb: Storyboard
  time: MotionValue<number>
  total: number
}): React.JSX.Element {
  const rec = useTransform(time, (v) => (Math.floor(v * 1.6) % 2 ? 0.25 : 1))
  const tc = useTransform(time, (v) => `${clock(v)} / ${clock(total)}`)
  const [w, h] = FORMATS[sb.format]
  return (
    <div className="pointer-events-none absolute inset-[3cqmin] flex flex-col justify-between rounded-[2cqmin] border border-current/15 p-[2.5cqmin] font-mono text-[1.9cqmin] tracking-widest opacity-70">
      <div className="flex justify-between">
        <span className="flex items-center gap-[1cqmin]">
          <motion.span
            className="size-[1.2cqmin] rounded-full"
            style={{ opacity: rec, background: sb.palette.accent }}
          />
          REC
        </span>
        <motion.span>{tc}</motion.span>
      </div>
      <div className="flex justify-between">
        <span>
          {w > h ? '16:9' : w < h ? '9:16' : '1:1'} · {Math.min(w, h)}P
        </span>
      </div>
    </div>
  )
}
