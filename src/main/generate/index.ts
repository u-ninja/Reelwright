import { z } from 'zod'
import { AiScene, AiStoryboard, type GenerateRequest, type Storyboard } from '../../shared/schema'
import { ollama } from '../providers/ollama'
import { finalize, inventedNumbers } from './validate'
import { MUSIC_CREDIT, narrate } from '../audio'

const KINDS: Record<GenerateRequest['kind'], string> = {
  launch: 'Hook → reveal what it is → 2-3 highlights → punchline or CTA.',
  explainer: 'Problem → idea → how it works in 2-4 beats → takeaway.',
  announcement: 'The news → why it matters → details (date, where, who) → what to do.',
  tutorial: 'Goal → one `step` scene per step → result.',
  promo: 'Hook → the offer or event → details → CTA.',
  story: 'Setup → turn → payoff.',
  custom: 'Follow the structure the user describes.'
}

const system = (
  kind: GenerateRequest['kind']
): string => `You write storyboards for short videos as JSON.
Structure: ${KINDS[kind]}
Rules:
- Hook in the first 2 seconds. Clear to a stranger. Reuse the user's own words.
- Never invent numbers, stats, quotes, testimonials or awards. Only use ones the user gave.
- No filler like "revolutionize", "seamless", "game-changer", "unlock", "elevate", "excited to share".
- Headlines at most 8 words. About 3-5 seconds per scene; give each scene time to read (0.3s per word).
- Templates: title(headline, sub), text(headline), feature(headline, sub), stat(headline is a number from the user, sub), quote(headline is the user's exact quote, sub is who said it), list(headline, items 2-5), step(headline, sub), code(headline is the terminal window title, items are 1-6 shell commands starting with "$ " or code lines; only for software topics), cta(headline, sub is the action or URL).
- Write like a sharp editor: open with a question or a bold line, short punchy lines, end on a punchline.
- Headline markup: *word* for an italic accent on 1-2 key words; ==word== for a highlight box (max one per scene); \n to build a headline line by line, e.g. "your idea,\nnow a *launch video.*".
- kicker: optional 1-3 word label above the headline, e.g. "ONE COMMAND".
- bg: "accent" or "inverse" on 1-3 punchy scenes (hook, payoff, CTA) for a full-bleed color flip; otherwise "base".
- hud: true for a camera / screen-recording look.
- Look: first think about the subject's mood, then design for it. If the user names colors or a style, use them.
  palette: bg, fg, accent hex colors made for this subject, strong contrast between bg and fg. Light backgrounds are welcome. Avoid the generic navy + sky blue.
  Examples: bakery → cream bg, espresso fg, cherry accent; heat pumps → ice white bg, deep teal fg, warm orange accent; techno night → black bg, white fg, acid green accent.
  font: "sans" (modern, product, tech), "serif" (editorial, food, culture, luxury, story), "mono" (developer, terminal, data).
- shareCopy: 1-3 plain sentences for posting the video.`

const NARRATION = `
- voiceover: one spoken line per scene, conversational, like a creator talking to camera. It adds to the on-screen text instead of reading it out. About 2.5 words per second of scene. Write numbers the way they are spoken.`

// One call constrained to the schema; one retry with the error if the reply still doesn't parse.
async function ask<T>(schema: z.ZodType<T>, sys: string, user: string): Promise<T> {
  const call = async (u: string): Promise<T> =>
    schema.parse(JSON.parse(await ollama(sys, u, z.toJSONSchema(schema))))
  try {
    return await call(user)
  } catch (e) {
    return call(`${user}\n\nYour previous reply was invalid: ${String(e).slice(0, 400)}`)
  }
}

export async function generate(req: GenerateRequest): Promise<Storyboard> {
  const sys = system(req.kind) + (req.voice ? NARRATION : '')
  const sb = await ask(
    AiStoryboard,
    sys,
    `Video: ${req.text}\nLength: ${req.duration}s, about ${Math.max(2, Math.round(req.duration / 4))} scenes. Tone: ${req.tone}.${req.voice ? ' Narration: on, write a voiceover line for every scene.' : ''}`
  )

  // Rule 1 + 2: re-ask only for the scenes with invented numbers; drop any that are still wrong.
  const bad = sb.scenes.flatMap((s, i) => (inventedNumbers(s, req.text).length ? [i] : []))
  if (bad.length) {
    const problems = bad.map((i) => ({
      scene: sb.scenes[i],
      numbersNotInSource: inventedNumbers(sb.scenes[i], req.text)
    }))
    try {
      const fix = await ask(
        z.object({ scenes: z.array(AiScene).length(bad.length) }),
        sys,
        `Source: ${req.text}\nRewrite each scene without numbers that are not in the source:\n${JSON.stringify(problems)}`
      )
      bad.forEach((i, j) => (sb.scenes[i] = fix.scenes[j]))
    } catch (e) {
      console.warn('scene repair failed, dropping scenes', e)
    }
    sb.scenes = sb.scenes.filter((s) => !inventedNumbers(s, req.text).length)
    if (!sb.scenes.length)
      throw new Error('Every scene used numbers that are not in your description.')
  }
  const out = finalize(sb, req)
  return narrate({
    ...out,
    voice: req.voice,
    music: req.music,
    shareCopy: req.music ? `${out.shareCopy}\n\n${MUSIC_CREDIT}` : out.shareCopy
  })
}
