import {
  type AiScene,
  type AiStoryboard,
  type GenerateRequest,
  type Scene,
  type Storyboard,
  VO_LEAD,
  VO_TAIL
} from '../../shared/schema'

const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%]+/gu, ' ')
    .trim()
const numbers = (s: string): string[] =>
  (s.match(/\d[\d.,]*/g) ?? []).map((n) => n.replace(/,/g, '').replace(/\.$/, ''))

// Rule 2: numbers on screen that the source never mentions. Code lines are commands, not claims.
export function inventedNumbers(s: AiScene, source: string): string[] {
  const known = new Set(numbers(source))
  const items = s.template === 'code' ? [] : (s.items ?? [])
  return numbers([s.headline, s.sub ?? '', s.voiceover ?? '', ...items].join(' ')).filter(
    (n) => !known.has(n)
  )
}

// Rule 2: a quote must be the source's own words, otherwise it becomes a plain feature scene.
const checkQuote = (s: AiScene, source: string): AiScene =>
  s.template === 'quote' && !norm(source).includes(norm(s.headline))
    ? { ...s, template: 'feature', sub: undefined }
    : s

// Scale scene lengths so they add up to the target (±0.1s).
export function fitDuration<T extends { durationSec: number }>(scenes: T[], target: number): T[] {
  const sum = scenes.reduce((a, s) => a + s.durationSec, 0)
  const out = scenes.map((s) => ({
    ...s,
    durationSec: Math.max(0.5, Math.round(((s.durationSec * target) / sum) * 10) / 10)
  }))
  const last = out[out.length - 1]
  const rest = out.reduce((a, s) => a + s.durationSec, 0) - last.durationSec
  last.durationSec = Math.max(0.5, Math.round((target - rest) * 10) / 10)
  return out
}

// Stretch each scene so it holds its narration line (never cut or speed up speech).
export function fitVoice(sb: Storyboard, secs: (number | undefined)[]): Storyboard {
  return {
    ...sb,
    scenes: sb.scenes.map((s, i) => {
      const need = secs[i] === undefined ? 0 : Math.ceil((secs[i]! + VO_LEAD + VO_TAIL) * 10) / 10
      return { ...s, durationSec: Math.max(s.durationSec, need) }
    })
  }
}

export const finalize = (ai: AiStoryboard, req: GenerateRequest): Storyboard => ({
  ...ai,
  kind: req.kind,
  tone: req.tone,
  format: req.format,
  scenes: fitDuration(
    ai.scenes.map((s) => checkQuote(s, req.text)),
    req.duration
  ) as Scene[]
})
