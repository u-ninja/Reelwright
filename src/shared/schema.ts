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
    'logo',
    'cta',
    'custom'
  ]),
  durationSec: z.number().min(0.5).max(60),
  headline: z.string(),
  sub: z.string().optional(),
  items: z.array(z.string()).optional(),
  asset: z.string().optional(), // shortcut: an image URL for now, becomes a key into brief assets in milestone 4
  transitionIn: z.enum(['fade', 'slide', 'wipe', 'zoom', 'cut']),
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
  scenes: z.array(Scene).min(1),
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
