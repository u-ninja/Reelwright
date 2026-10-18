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
  asset: z.string().optional(), // shortcut: an image URL for now, becomes a key into brief assets in milestone 4
  transitionIn: z.enum(['fade', 'slide', 'wipe', 'zoom', 'cut']),
  bg: z.enum(['base', 'accent', 'inverse']).optional(), // full-bleed color flip for this scene
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

// What the AI writes. Kind/tone/format come from the user; asset templates wait for attachments (milestone 4a).
export const AiScene = Scene.omit({ asset: true, section: true }).extend({
  template: z.enum(['title', 'text', 'feature', 'stat', 'quote', 'list', 'step', 'code', 'cta'])
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
  duration: z.number().min(5).max(60)
})
export type GenerateRequest = z.infer<typeof GenerateRequest>
