import { z } from 'zod'
import {
  AiScene,
  AiStoryboard,
  type Attachment,
  type GenerateRequest,
  type Storyboard
} from '../../shared/schema'
import { ollama } from '../providers/ollama'
import { type Labels, finalize, inventedNumbers } from './validate'
import { getAttachment } from '../attachments'
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
- voiceover: one spoken line per scene, conversational, like a creator talking to camera, about 2.5 words per second of scene. Write numbers the way they are spoken.
- The headline must be the key phrase of that scene's voiceover, using the same words, so the viewer reads what they hear. The voiceover can say more around it.
  Example: voiceover "First, rinse the paper filter so your coffee doesn't taste like cardboard." → headline "Rinse the *filter*".`

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

const MEDIA = `
- Media templates: logo(asset is an image label, headline), screenshot(asset is an image label, headline), footage(asset is a video label; the clip plays full-screen with the headline over it, optional kicker). Use every attached image or video at least once.`

// Attachments become "img1" / "vid1" labels the AI can put in a scene's asset, and documents become
// source text, which the invented-claims check also uses.
function describe(ids: string[]): {
  labels: Labels
  names: Record<string, string>
  media: string
  docs: string
} {
  const n = { image: 0, video: 0, doc: 0 }
  const prefix = { image: 'img', video: 'vid', doc: 'doc' }
  const atts = ids.map(getAttachment).filter((a): a is Attachment => !!a)
  const labeled = atts.map((a) => ({ a, label: prefix[a.kind] + ++n[a.kind] }))
  const visual = labeled.filter((l) => l.a.kind !== 'doc')
  return {
    labels: Object.fromEntries(visual.map((l) => [l.label, { url: l.a.url, kind: l.a.kind }])),
    names: Object.fromEntries(visual.map((l) => [l.label, l.a.name])),
    media: visual.map((l) => `- ${l.label}: ${l.a.name} (${l.a.info})`).join('\n'),
    docs: labeled
      .filter((l) => l.a.kind === 'doc')
      .map((l) => `--- ${l.a.name} ---\n${l.a.text}`)
      .join('\n\n')
  }
}

export async function generate(req: GenerateRequest): Promise<Storyboard> {
  const { labels, names, media, docs } = describe(req.attachments)
  const source = docs ? `${req.text}\n\n${docs}` : req.text
  const sys = system(req.kind) + (req.voice ? NARRATION : '') + (media ? MEDIA : '')
  const sb = await ask(
    AiStoryboard,
    sys,
    `Video: ${req.text}${docs ? `\n\nSource documents (facts you may use):\n${docs}` : ''}${media ? `\n\nAttached media (put the label in a scene's asset):\n${media}` : ''}\nLength: ${req.duration}s, about ${Math.max(2, Math.round(req.duration / 4))} scenes. Tone: ${req.tone}.${req.voice ? ' Narration: on, write a voiceover line for every scene.' : ''}`
  )

  // Rule 1 + 2: re-ask only for the scenes with invented numbers; drop any that are still wrong.
  const bad = sb.scenes.flatMap((s, i) => (inventedNumbers(s, source).length ? [i] : []))
  if (bad.length) {
    const problems = bad.map((i) => ({
      scene: sb.scenes[i],
      numbersNotInSource: inventedNumbers(sb.scenes[i], source)
    }))
    try {
      const fix = await ask(
        z.object({ scenes: z.array(AiScene).length(bad.length) }),
        sys,
        `Source: ${source}\nRewrite each scene without numbers that are not in the source:\n${JSON.stringify(problems)}`
      )
      bad.forEach((i, j) => (sb.scenes[i] = fix.scenes[j]))
    } catch (e) {
      console.warn('scene repair failed, dropping scenes', e)
    }
    sb.scenes = sb.scenes.filter((s) => !inventedNumbers(s, source).length)
    if (!sb.scenes.length)
      throw new Error('Every scene used numbers that are not in your description.')
  }
  const out = finalize(sb, req, source, labels, names)
  return narrate({
    ...out,
    voice: req.voice,
    music: req.music,
    shareCopy: req.music ? `${out.shareCopy}\n\n${MUSIC_CREDIT}` : out.shareCopy
  })
}
