import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

import { type Scene, type Storyboard, duration } from './storyboard'

const ease = (x: number): number => 1 - (1 - Math.min(Math.max(x, 0), 1)) ** 3

// Every style is a function of t (seconds into the scene) so capture is deterministic.
function SceneView({ s, t, sb }: { s: Scene; t: number; sb: Storyboard }): React.JSX.Element {
  const enter = ease(t / 0.6)
  const opacity = enter * (1 - ease((t - s.durationSec + 0.4) / 0.4))
  const sub = ease((t - 0.3) / 0.6)
  if (s.template === 'title')
    return (
      <div className="flex h-full items-center justify-center" style={{ opacity }}>
        <h1 className="text-[180px] font-bold" style={{ transform: `scale(${0.9 + 0.1 * enter})` }}>
          {s.headline}
        </h1>
      </div>
    )
  return (
    <div className="flex h-full flex-col justify-center gap-8 px-40" style={{ opacity }}>
      <div
        className="h-3 rounded-full"
        style={{ width: 240 * enter, background: sb.palette.accent }}
      />
      <h2
        className="text-[120px] font-bold"
        style={{ transform: `translateX(${(1 - enter) * -60}px)` }}
      >
        {s.headline}
      </h2>
      <p
        className="text-[56px] opacity-70"
        style={{ opacity: sub * 0.7, transform: `translateY(${(1 - sub) * 30}px)` }}
      >
        {s.sub}
      </p>
    </div>
  )
}

export function Player({ sb, t }: { sb: Storyboard; t: number }): React.JSX.Element {
  let start = 0
  let i = 0
  while (i < sb.scenes.length - 1 && t >= start + sb.scenes[i].durationSec)
    start += sb.scenes[i++].durationSec
  return (
    <div
      className="h-[1080px] w-[1920px] overflow-hidden"
      style={{ background: sb.palette.bg, color: sb.palette.fg }}
    >
      <SceneView key={i} s={sb.scenes[i]} t={t - start} sb={sb} />
    </div>
  )
}

declare global {
  interface Window {
    __seek: (t: number) => Promise<void>
    __duration: number
  }
}

// Mounted in the offscreen render window; main calls __seek(t) then captures.
export function RenderRoot({ sb }: { sb: Storyboard }): React.JSX.Element {
  const [t, setT] = useState(0)
  useEffect(() => {
    window.__duration = duration(sb)
    window.__seek = async (next) => {
      flushSync(() => setT(next))
      await document.fonts.ready
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    }
  }, [sb])
  return <Player sb={sb} t={t} />
}
