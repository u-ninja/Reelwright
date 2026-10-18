import { describe, expect, it } from 'vitest'
import { finalize, fitDuration, inventedNumbers } from './validate'
import type { AiScene, GenerateRequest } from '../../shared/schema'

const scene = (s: Partial<AiScene>): AiScene => ({
  template: 'feature',
  durationSec: 3,
  headline: '',
  transitionIn: 'fade',
  ...s
})
const req: GenerateRequest = {
  text: 'Ship 3x faster. Used by 1,200 teams. "It just works" says Ana.',
  kind: 'launch',
  tone: 'default',
  format: 'landscape',
  duration: 20
}

describe('inventedNumbers', () => {
  it('flags numbers the source never mentions', () => {
    expect(
      inventedNumbers(scene({ template: 'stat', headline: '92% success rate' }), req.text)
    ).toEqual(['92'])
  })
  it('accepts numbers from the source, ignoring thousands separators', () => {
    expect(inventedNumbers(scene({ headline: '1200 teams', sub: '3x faster' }), req.text)).toEqual(
      []
    )
  })
  it('ignores numbers inside code lines', () => {
    expect(
      inventedNumbers(
        scene({ template: 'code', headline: 'zsh', items: ['$ npm i react@19'] }),
        req.text
      )
    ).toEqual([])
  })
  it('checks list items too', () => {
    expect(
      inventedNumbers(
        scene({ template: 'list', headline: 'Why', items: ['10 integrations'] }),
        req.text
      )
    ).toEqual(['10'])
  })
})

describe('fitDuration', () => {
  it('scales to the target within 0.1s', () => {
    const out = fitDuration([{ durationSec: 4 }, { durationSec: 5 }, { durationSec: 6 }], 20)
    expect(Math.abs(out.reduce((a, s) => a + s.durationSec, 0) - 20)).toBeLessThanOrEqual(0.1)
  })
})

describe('finalize', () => {
  it('turns a quote that is not in the source into a feature and drops its attribution', () => {
    const sb = finalize(
      {
        title: 't',
        palette: { bg: '#000', fg: '#fff', accent: '#fc0' },
        shareCopy: '',
        scenes: [
          scene({ template: 'quote', headline: 'Life changing', sub: 'A fan' }),
          scene({ template: 'quote', headline: 'It just works', sub: 'Ana' })
        ]
      },
      req
    )
    expect(sb.scenes.map((s) => [s.template, s.sub])).toEqual([
      ['feature', undefined],
      ['quote', 'Ana']
    ])
    expect(sb.kind).toBe('launch')
  })
})
