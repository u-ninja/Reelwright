export type Scene = {
  template: 'title' | 'feature'
  durationSec: number
  headline: string
  sub?: string
}
export type Storyboard = { palette: { bg: string; fg: string; accent: string }; scenes: Scene[] }

export const demo: Storyboard = {
  palette: { bg: '#0b0b10', fg: '#f5f5f7', accent: '#7c5cff' },
  scenes: [
    { template: 'title', durationSec: 3, headline: 'Reelwright' },
    {
      template: 'feature',
      durationSec: 3.5,
      headline: 'Describe it.',
      sub: 'A URL or a sentence is enough.'
    },
    {
      template: 'feature',
      durationSec: 3.5,
      headline: 'Get a video.',
      sub: 'Rendered on your machine.'
    }
  ]
}

export const duration = (sb: Storyboard): number => sb.scenes.reduce((a, s) => a + s.durationSec, 0)
