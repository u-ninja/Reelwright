import { createContext, useContext } from 'react'
import {
  type EasingFunction,
  type MotionValue,
  anticipate,
  backOut,
  circOut,
  easeIn,
  easeInOut,
  useTransform
} from 'motion/react'
import type { Scene, Storyboard } from '../../../shared/schema'

// Tone = motion language: entrance length (s), stagger between words (s), easing, text style.
// rise: words slide up out of a mask. blur: letters sharpen in. punch: words overshoot in. cut: no motion.
export type TextStyle = 'rise' | 'blur' | 'punch' | 'cut'
export const TONES: Record<
  Storyboard['tone'],
  { enter: number; stagger: number; ease: EasingFunction; style: TextStyle }
> = {
  default: { enter: 0.7, stagger: 0.06, ease: circOut, style: 'rise' },
  polished: { enter: 0.9, stagger: 0.05, ease: easeInOut, style: 'blur' },
  'yc-parody': { enter: 0.45, stagger: 0.08, ease: backOut, style: 'punch' },
  chaotic: { enter: 0.3, stagger: 0.04, ease: anticipate, style: 'punch' },
  deadpan: { enter: 0.01, stagger: 0, ease: circOut, style: 'cut' },
  cinematic: { enter: 1.4, stagger: 0.07, ease: easeInOut, style: 'blur' },
  'app-store': { enter: 0.6, stagger: 0.05, ease: backOut, style: 'rise' }
}

// t = seconds into the scene, time = seconds into the video. Everything on screen derives from these.
export type Local = {
  t: MotionValue<number>
  time: MotionValue<number>
  s: Scene
  sb: Storyboard
  step: number
}
export const LocalCtx = createContext<Local>(null!)
// Tone timing, capped so short scenes are readable for most of their length.
export const useLocal = (): Local & { tone: (typeof TONES)[Storyboard['tone']] } => {
  const l = useContext(LocalCtx)
  const tone = TONES[l.sb.tone]
  return { ...l, tone: { ...tone, enter: Math.min(tone.enter, l.s.durationSec * 0.3) } }
}

// 0→1 entrance starting `delay` s into the scene (can overshoot 1 with back easings).
export function useEnter(delay: number, length?: number): MotionValue<number> {
  const { t, tone } = useLocal()
  return useTransform(t, [delay, delay + (length ?? tone.enter)], [0, 1], { ease: tone.ease })
}

// 0→1 over the last 0.35s of the scene.
export function useExit(): MotionValue<number> {
  const { t, s } = useLocal()
  return useTransform(t, [s.durationSec - 0.35, s.durationSec], [0, 1], { ease: easeIn })
}

// Start time of block i (headline, sub, image…) inside a scene.
export const blockStart = (i: number, enter: number): number => i * Math.max(0.15, enter * 0.45)
