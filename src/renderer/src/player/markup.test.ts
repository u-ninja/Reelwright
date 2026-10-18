import { describe, expect, it } from 'vitest'
import { countable, parseMarkup, plainText } from './markup'

describe('parseMarkup', () => {
  it('splits lines, marks accent and highlight runs, and delays later lines', () => {
    const lines = parseMarkup("your site,\nnow a *launch video.* let's ==brag==", 0, 0.1, 0.5)
    expect(lines.map((l) => l.map((w) => [w.text, w.mark]))).toEqual([
      [
        ['your', 'plain'],
        ['site,', 'plain']
      ],
      [
        ['now', 'plain'],
        ['a', 'plain'],
        ['launch', 'accent'],
        ['video.', 'accent'],
        ["let's", 'plain'],
        ['brag', 'highlight']
      ]
    ])
    // word 3 overall, on line 1: 0.5 line gap + 2 * 0.1
    expect(lines[1][0].delay).toBeCloseTo(0.7)
    // words of one marked run share a segment so the highlight box wraps them together
    expect(lines[1][2].seg).toBe(lines[1][3].seg)
  })
  it('strips markup for screen readers', () => {
    expect(plainText('now a *launch*\n==video==')).toBe('now a launch video')
  })
})

describe('countable', () => {
  it('counts leading numbers with symbols and separators', () => {
    expect(countable('$15')).toEqual(['$', '15', ''])
    expect(countable('1,200 teams')).toEqual(['', '1,200', ' teams'])
  })
  it('never counts years or numbers inside a sentence', () => {
    expect(countable('2005')).toBeNull()
    expect(countable('Launched in 2005')).toBeNull()
  })
})
