import { app } from 'electron'
import { spawn } from 'child_process'
import { once } from 'events'
import { createHash } from 'crypto'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import music from '../../resources/music/happy-beats-business-moves-vol-1-by-ende-dot-app.mp3?asset'
import { type Storyboard, VO_LEAD, duration, sceneStarts } from '../shared/schema'
import { fitVoice } from './generate/validate'

// shortcut: Homebrew ffmpeg path, bundle ffmpeg in milestone 9.
export const FFMPEG = process.env['FFMPEG'] ?? '/opt/homebrew/bin/ffmpeg'
const FFPROBE = FFMPEG.replace(/ffmpeg$/, 'ffprobe')
export const MUSIC_CREDIT = 'Music: "Happy Beats / Business Moves Vol. 1" by ende.app (CC BY 4.0)'

const dir = (name: string): string => {
  const d = join(app.getPath('userData'), name)
  mkdirSync(d, { recursive: true })
  return d
}
const hash = (x: unknown): string =>
  createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 16)

async function run(cmd: string, args: string[]): Promise<string> {
  const p = spawn(cmd, args)
  let out = ''
  let err = ''
  p.stdout.on('data', (d) => (out += d))
  p.stderr.on('data', (d) => (err = (err + d).slice(-2000)))
  const [code] = await once(p, 'close')
  if (code !== 0) throw new Error(`${cmd} exited ${code}: ${err}`)
  return out
}

// Kokoro-82M runs locally; the model downloads once into the app's data folder.
type Tts = {
  generate: (text: string, o: { voice: string }) => Promise<{ save: (p: string) => Promise<void> }>
}
let tts: Promise<Tts> | undefined
const model = (): Promise<Tts> =>
  (tts ??= (async () => {
    const [{ KokoroTTS }, { env }] = await Promise.all([
      import('kokoro-js'),
      import('@huggingface/transformers')
    ])
    env.cacheDir = dir('models')
    return (await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',
      device: 'cpu'
    })) as unknown as Tts
  })())

// One cached WAV per (voice, line).
export async function speak(text: string, voice: string): Promise<{ path: string; sec: number }> {
  const path = join(dir('voice'), hash([voice, text]) + '.wav')
  if (!existsSync(path)) await (await (await model()).generate(text, { voice })).save(path)
  const sec = +(await run(FFPROBE, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'csv=p=0',
    path
  ]))
  return { path, sec }
}

// Record every narration line and stretch scenes that need more time.
export async function narrate(sb: Storyboard): Promise<Storyboard> {
  if (!sb.voice) return sb
  const secs: (number | undefined)[] = []
  for (const s of sb.scenes)
    secs.push(s.voiceover ? (await speak(s.voiceover, sb.voice)).sec : undefined)
  return fitVoice(sb, secs)
}

// Mix narration + music (looped, ducked under the voice, faded) into one AAC track the length of the video.
// Returns null when the video has no sound at all.
export async function soundtrack(sb: Storyboard): Promise<string | null> {
  const starts = sceneStarts(sb)
  const lines = sb.voice
    ? sb.scenes.flatMap((s, i) =>
        s.voiceover ? [{ text: s.voiceover, at: starts[i] + VO_LEAD }] : []
      )
    : []
  const withMusic = sb.music !== false
  if (!lines.length && !withMusic) return null
  const total = duration(sb)
  const out = join(dir('soundtrack'), hash([sb.voice, withMusic, lines, total]) + '.m4a')
  if (existsSync(out)) return out

  const voice = await Promise.all(lines.map((l) => speak(l.text, sb.voice!)))
  const inputs = voice.flatMap((v) => ['-i', v.path])
  const f: string[] = voice.map(
    (_, i) => `[${i}]adelay=${Math.round(lines[i].at * 1000)}:all=1[v${i}]`
  )
  if (voice.length)
    f.push(`${voice.map((_, i) => `[v${i}]`).join('')}amix=inputs=${voice.length}:normalize=0[vo]`)
  if (withMusic) {
    inputs.push('-stream_loop', '-1', '-i', music)
    f.push(
      `[${voice.length}]atrim=0:${total},asetpts=PTS-STARTPTS,afade=t=in:d=0.8,afade=t=out:st=${Math.max(0, total - 2.5)}:d=2.5,volume=0.55[m]`
    )
    if (voice.length)
      f.push(
        '[vo]asplit[sc][vmix]',
        '[m][sc]sidechaincompress=threshold=0.015:ratio=10:attack=30:release=500[duck]',
        '[duck][vmix]amix=inputs=2:normalize=0[mix]'
      )
  }
  const last = withMusic ? (voice.length ? '[mix]' : '[m]') : '[vo]'
  f.push(
    `${last}aformat=sample_rates=48000:channel_layouts=stereo,apad=whole_dur=${total},loudnorm=I=-14:TP=-1.5[out]`
  )
  await run(FFMPEG, [
    '-y',
    ...inputs,
    '-filter_complex',
    f.join(';'),
    '-map',
    '[out]',
    '-t',
    String(total),
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    out
  ])
  return out
}
