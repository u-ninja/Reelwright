import type { Storyboard } from './schema'

const svg = (body: string): string =>
  'data:image/svg+xml,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" ${body}</svg>`)

const screenshot = svg(
  `width="1600" height="1000" viewBox="0 0 1600 1000"><rect width="1600" height="1000" fill="#1d1d24"/><rect width="1600" height="64" fill="#2a2a33"/><circle cx="40" cy="32" r="10" fill="#f2b632"/><rect x="80" y="140" width="700" height="60" rx="12" fill="#f5f5f7"/><rect x="80" y="240" width="1000" height="28" rx="8" fill="#55555f"/><rect x="80" y="290" width="860" height="28" rx="8" fill="#55555f"/><rect x="80" y="400" width="680" height="480" rx="24" fill="#f2b632" opacity=".8"/><rect x="820" y="400" width="680" height="480" rx="24" fill="#3d7bff" opacity=".8"/>`
)
const logo = svg(
  `viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#f2b632"/><path d="M38 30 L72 50 L38 70 Z" fill="#0b0b10"/>`
)

// Exercises every template and transition; used by the UI and the LR_RENDER smoke test.
export const demo: Storyboard = {
  title: 'Reelwright — every template',
  kind: 'explainer',
  tone: 'default',
  format: 'landscape',
  palette: { bg: '#0b0b10', fg: '#f5f5f7', accent: '#f2b632' },
  shareCopy: 'A video from a sentence, rendered on your own machine.',
  scenes: [
    { template: 'logo', durationSec: 2, headline: 'Reelwright', asset: logo, transitionIn: 'zoom' },
    {
      template: 'title',
      durationSec: 2.5,
      headline: 'Videos from a sentence.',
      sub: 'Seconds to minutes.',
      transitionIn: 'fade'
    },
    {
      template: 'feature',
      durationSec: 2.5,
      headline: 'Describe it.',
      sub: 'A URL or a sentence is enough.',
      transitionIn: 'slide'
    },
    {
      template: 'stat',
      durationSec: 2,
      headline: '30 fps',
      sub: 'rendered frame by frame',
      transitionIn: 'wipe'
    },
    {
      template: 'list',
      durationSec: 3,
      headline: 'Works with',
      items: ['Ollama', 'Claude', 'Gemini', 'OpenAI'],
      transitionIn: 'slide'
    },
    { template: 'step', durationSec: 2, headline: 'Chat about the video', transitionIn: 'cut' },
    { template: 'step', durationSec: 2, headline: 'Preview every frame', transitionIn: 'cut' },
    {
      template: 'screenshot',
      durationSec: 2.5,
      headline: 'What you see is what renders.',
      asset: screenshot,
      transitionIn: 'zoom'
    },
    {
      template: 'quote',
      durationSec: 2.5,
      headline: 'The best code is the code never written.',
      sub: 'the ponytail rule',
      transitionIn: 'fade'
    },
    { template: 'text', durationSec: 1.5, headline: 'No cloud required.', transitionIn: 'wipe' },
    {
      template: 'cta',
      durationSec: 2.5,
      headline: 'Make your first video',
      sub: 'github.com/u-ninja/Reelwright',
      transitionIn: 'zoom'
    }
  ]
}
