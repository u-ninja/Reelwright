import { describe, expect, it } from 'vitest'
import { finalize, fitDuration, fitVoice, inventedNumbers, placeMedia } from './validate'
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
  duration: 20,
  music: false,
  attachments: []
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
  it('checks narration lines too', () => {
    expect(
      inventedNumbers(scene({ headline: 'Fast', voiceover: 'Used by 5000 teams' }), req.text)
    ).toEqual(['5000'])
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

describe('attachments', () => {
  it('maps labels to URLs; media scenes without a matching file become features', () => {
    const sb = finalize(
      {
        title: 't',
        palette: { bg: '#000', fg: '#fff', accent: '#fc0' },
        shareCopy: '',
        scenes: [
          scene({ template: 'footage', asset: 'vid1' }),
          scene({ template: 'logo', asset: 'vid1' }), // wrong kind
          scene({ template: 'screenshot', asset: 'img9' }), // missing
          scene({ template: 'feature', asset: 'img1' }) // a label on a non-media scene switches it to media
        ]
      },
      req,
      req.text,
      {
        vid1: { url: 'app-asset://file/aaaaaaaaaaaaaaaa.mp4', kind: 'video' },
        img1: { url: 'u', kind: 'image' }
      }
    )
    expect(sb.scenes.map((s) => [s.template, s.asset])).toEqual([
      ['footage', 'app-asset://file/aaaaaaaaaaaaaaaa.mp4'],
      ['feature', undefined],
      ['feature', undefined],
      ['screenshot', 'u']
    ])
  })
})

describe('placeMedia', () => {
  it('gives every unused image or clip a scene, never the opening hook', () => {
    const out = placeMedia(
      [
        scene({ template: 'title' }),
        scene({ template: 'feature' }),
        scene({ template: 'text' }),
        scene({ template: 'feature', asset: 'img1' })
      ],
      {
        img1: { url: 'a', kind: 'image' },
        img2: { url: 'b', kind: 'image' },
        vid1: { url: 'c', kind: 'video' }
      },
      { img2: 'brand-logo.png' }
    )
    expect(out.map((s) => [s.template, s.asset])).toEqual([
      ['title', undefined],
      ['logo', 'img2'],
      ['footage', 'vid1'],
      ['screenshot', 'img1']
    ])
  })
})

describe('placeMedia with bad labels', () => {
  it("fills the model's own empty media scenes when it misspells a label", () => {
    const out = placeMedia(
      [
        scene({ template: 'title' }),
        scene({ template: 'footage', asset: 'video1' }),
        scene({ template: 'list' })
      ],
      { vid1: { url: 'c', kind: 'video' } }
    )
    expect(out.map((s) => [s.template, s.asset])).toEqual([
      ['title', undefined],
      ['footage', 'vid1'],
      ['list', undefined]
    ])
  })
})

describe('fitVoice', () => {
  it('stretches only scenes whose narration is longer than the scene', () => {
    const sb = finalize(
      {
        title: 't',
        palette: { bg: '#000', fg: '#fff', accent: '#fc0' },
        shareCopy: '',
        scenes: [scene({ durationSec: 10 }), scene({ durationSec: 10 })]
      },
      req
    )
    // scene 1 holds 3s easily; scene 2 needs 12s of speech + 0.3 lead + 0.5 tail
    expect(fitVoice(sb, [3, 12]).scenes.map((s) => s.durationSec)).toEqual([10, 12.8])
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
