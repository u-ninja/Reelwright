export type Word = {
  text: string
  mark: 'plain' | 'accent' | 'highlight'
  delay: number
  seg: number
}

// "your site,\nnow a *launch video.*" → lines of words with their style and start time.
// Lines build one after another; *x* = italic accent, ==x== = highlight box.
export function parseMarkup(text: string, start: number, gap: number, lineGap: number): Word[][] {
  let n = 0
  let seg = 0
  return text.split('\n').map((line, k) =>
    line.split(/(\*[^*]+\*|==[^=]+==)/).flatMap((part) => {
      const mark = part.startsWith('==') ? 'highlight' : part.startsWith('*') ? 'accent' : 'plain'
      const body =
        mark === 'highlight' ? part.slice(2, -2) : mark === 'accent' ? part.slice(1, -1) : part
      seg++
      return body
        .split(' ')
        .filter(Boolean)
        .map((w) => ({ text: w, mark, seg, delay: start + k * lineGap + n++ * gap }) as Word)
    })
  )
}

export const plainText = (text: string): string => text.replace(/\*|==/g, '').replace(/\n/g, ' ')

// "30 fps" / "$15" / "1,200 teams" → [prefix, number, rest]. Only a number that leads the
// headline counts up; years ("Launched in 2005", "2005") stay fixed so no wrong date is ever on screen.
export function countable(text: string): [string, string, string] | null {
  const m = text.match(/^([^\p{L}\d]*)(\d[\d,]*\.?\d*)(.*)$/u)
  if (!m || /^(1[89]|20)\d\d$/.test(m[2])) return null
  return [m[1], m[2], m[3]]
}
