import {
  type AiScene,
  type AiStoryboard,
  type Attachment,
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

export type Labels = Record<string, Pick<Attachment, 'url' | 'kind'>>

// "img1" → its app-asset URL. An image/video template without a matching attachment becomes a
// feature scene, so the AI can never point a scene at a file that isn't there.
function useAsset(s: AiScene, labels: Labels): AiScene {
  const a = s.asset ? labels[s.asset] : undefined
  const need =
    s.template === 'footage'
      ? 'video'
      : s.template === 'logo' || s.template === 'screenshot'
        ? 'image'
        : null
  if (need && a?.kind !== need) return { ...s, template: 'feature', asset: undefined }
  return { ...s, asset: need ? a!.url : undefined }
}

// Every attached image or video appears at least once: unused ones take over a feature/text scene
// (images become screenshots, or a logo when the file is named like one; clips become footage).
export function placeMedia(
  scenes: AiScene[],
  labels: Labels,
  names: Record<string, string> = {}
): AiScene[] {
  const media = (label: string): AiScene['template'] =>
    labels[label].kind === 'video'
      ? 'footage'
      : /logo/i.test(names[label] ?? '')
        ? 'logo'
        : 'screenshot'
  const isMedia = (t: AiScene['template']): boolean =>
    t === 'footage' || t === 'logo' || t === 'screenshot'
  // unknown labels ("video1" for "vid1") count as no asset; a valid label on a non-media scene
  // means the model wanted it shown, so switch that scene to the right template
  const out = scenes.map((s) => {
    const asset = s.asset && labels[s.asset] ? s.asset : undefined
    return asset && !isMedia(s.template) ? { ...s, asset, template: media(asset) } : { ...s, asset }
  })
  const used = new Set(out.map((s) => s.asset))
  for (const label of Object.keys(labels)) {
    if (used.has(label)) continue
    const want = media(label)
    // fill an empty media scene of the right kind first, then a feature, then a text scene; never the hook
    const free = (test: (s: AiScene) => boolean): number =>
      out.findIndex((s, k) => k > 0 && !s.asset && test(s))
    const i = [
      free((s) =>
        want === 'footage'
          ? s.template === 'footage'
          : s.template === 'logo' || s.template === 'screenshot'
      ),
      free((s) => s.template === 'feature'),
      free((s) => s.template === 'text')
    ].find((k) => k >= 0)
    if (i === undefined) continue
    out[i] = { ...out[i], asset: label, template: out[i].template === 'logo' ? 'logo' : want }
  }
  return out
}

// source = the user's text plus any attached documents; claims are checked against all of it.
export const finalize = (
  ai: AiStoryboard,
  req: GenerateRequest,
  source = req.text,
  labels: Labels = {},
  names: Record<string, string> = {}
): Storyboard => ({
  ...ai,
  kind: req.kind,
  tone: req.tone,
  format: req.format,
  scenes: fitDuration(
    placeMedia(ai.scenes, labels, names).map((s) => checkQuote(useAsset(s, labels), source)),
    req.duration
  ) as Scene[]
})
