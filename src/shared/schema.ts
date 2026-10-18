import { z } from 'zod'

// Single source of truth for the storyboard; later also emitted as JSON schema for providers.
export const Scene = z.object({
  template: z.enum([
    'title',
    'text',
    'feature',
    'stat',
    'quote',
    'screenshot',
    'list',
    'step',
    'code',
    'footage',
    'logo',
    'cta',
    'custom'
  ]),
  durationSec: z.number().min(0.5).max(60),
  // headline markup: *word* = italic accent, ==word== = highlight box, \n = next line builds in after
  headline: z.string(),
  kicker: z.string().optional(), // small mono label above the headline
  sub: z.string().optional(),
  items: z.array(z.string()).optional(),
  asset: z.string().optional(), // image or video URL (app-asset://… for attachments, data: for built-ins)
  transitionIn: z.enum(['fade', 'slide', 'wipe', 'zoom', 'cut']),
  bg: z.enum(['base', 'accent', 'inverse']).optional(), // full-bleed color flip for this scene
  voiceover: z.string().optional(), // narration for this scene; adds to the on-screen text, never contradicts it
  section: z.string().optional()
})

export const Storyboard = z.object({
  title: z.string(),
  kind: z.enum(['launch', 'explainer', 'announcement', 'tutorial', 'promo', 'story', 'custom']),
  tone: z.enum([
    'default',
    'polished',
    'yc-parody',
    'chaotic',
    'deadpan',
    'cinematic',
    'app-store'
  ]),
  format: z.enum(['landscape', 'vertical', 'square']),
  palette: z.object({ bg: z.string(), fg: z.string(), accent: z.string() }),
  font: z.enum(['sans', 'serif', 'mono']).optional(), // type family for the whole video
  scenes: z.array(Scene).min(1),
  hud: z.boolean().optional(), // REC / timecode frame overlay
  voice: z.string().optional(), // Kokoro voice id; absent = no narration
  music: z.boolean().optional(), // background music, on unless false
  shareCopy: z.string()
})

export type Scene = z.infer<typeof Scene>
export type Storyboard = z.infer<typeof Storyboard>

export const FORMATS = {
  landscape: [1920, 1080],
  vertical: [1080, 1920],
  square: [1080, 1080]
} as const

export const duration = (sb: Storyboard): number => sb.scenes.reduce((a, s) => a + s.durationSec, 0)

export type Attachment = {
  id: string // content hash
  name: string
  kind: 'image' | 'video' | 'doc'
  url: string // app-asset://file/<id>.<ext>
  info: string // one line for the AI, e.g. "image 1920x1080", "video 12.3s"
  text?: string // extracted document text
}

// Start time of every scene, in seconds.
export const sceneStarts = (sb: Storyboard): number[] =>
  sb.scenes.map((_, i) => sb.scenes.slice(0, i).reduce((a, s) => a + s.durationSec, 0))

// A narration line starts this long after its scene does, and the scene holds this long after it ends.
export const VO_LEAD = 0.3
export const VO_TAIL = 0.5

// What the AI writes. Kind/tone/format come from the user; asset templates wait for attachments (milestone 4a).
// asset is an attachment label like "img1" / "vid1" here; finalize maps it to the real URL.
export const AiScene = Scene.omit({ section: true }).extend({
  template: z.enum([
    'title',
    'text',
    'feature',
    'stat',
    'quote',
    'list',
    'step',
    'code',
    'cta',
    'logo',
    'screenshot',
    'footage'
  ])
})
export const AiStoryboard = z.object({
  title: z.string(),
  palette: Storyboard.shape.palette,
  font: Storyboard.shape.font,
  scenes: z.array(AiScene).min(1),
  hud: z.boolean().optional(),
  shareCopy: z.string()
})
export type AiScene = z.infer<typeof AiScene>
export type AiStoryboard = z.infer<typeof AiStoryboard>

// shortcut: max 60s until long-form (outline + per-section calls) lands in milestone 4b.
export const GenerateRequest = z.object({
  text: z.string().trim().min(1).max(4000),
  kind: Storyboard.shape.kind,
  tone: Storyboard.shape.tone,
  format: Storyboard.shape.format,
  duration: z.number().min(5).max(60),
  voice: z
    .enum(['af_heart', 'af_bella', 'am_michael', 'am_fenrir', 'bf_emma', 'bm_george'])
    .optional(),
  music: z.boolean(),
  attachments: z
    .array(z.string().regex(/^[a-f0-9]{16}$/))
    .max(10)
    .default([])
})
export type GenerateRequest = z.infer<typeof GenerateRequest>
