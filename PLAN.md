# launchreel — build plan

A desktop app that turns a **website URL and/or a text description** into a video of any kind, from a few seconds up to 10+ minutes, — product launch, explainer, announcement, tutorial, event promo, story, social clip — using **whatever AI the user connects**: local Ollama (free, unlimited), or Claude / Gemini / OpenAI through an API key or the user's own installed CLI. Inspired by the MIT-licensed `/brag-slim` skill (github.com/latent-spaces/brag): same creative rules, but the app does the rendering so the AI only has to write a small plan.

## Decisions already made

| Decision | Choice | Why |
|---|---|---|
| Shell | **Electron + electron-vite + React + TS + Tailwind v4** | Electron ships its own Chromium → frame capture renders identically on every OS; Node in main process runs ffmpeg and CLIs. Tauri uses the OS webview (inconsistent rendering, no reliable capture). |
| Animation | **Motion** (motion.dev) driven by a time MotionValue — see Motion section | Nice easing/springs for scenes and the UI without breaking deterministic capture. |
| UI kit | **shadcn/ui** (Tailwind v4 + React 19 mode) with Radix primitives, `lucide-react` icons | Components are copied into `src/renderer/src/components/ui/`, so they're ours to restyle. Needs the `@/` alias in `tsconfig.web.json` and `electron.vite.config.ts`. |
| No Next.js | — | Server rendering and API routes are unused in Electron. React components still port to a future web version. |
| Input (v1) | Chat message with URL and/or free text + **attachments** (images, documents) — see Attachments | Works the same locally and when hosted. Project-folder input comes later. |
| Length | 5s to 10 min (default 20s). Up to 60s = **short**; longer = **long-form** | Short stays one cheap call. Long-form plans an outline first, then writes one section per call, so small local models and token limits still work. |
| Voiceover | Optional narration via text-to-speech. Default engine **Kokoro** (`kokoro-js`, 82M ONNX model, Apache-2.0, runs locally on CPU, free). Paid options: OpenAI TTS, Gemini TTS, ElevenLabs (keys via safeStorage) | Local-first like Ollama; same "bring your own provider" pattern. Narration is what makes long-form watchable. |
| Video kind | User picks a **kind** (`launch`, `explainer`, `announcement`, `tutorial`, `promo`, `story`, `custom`); launch is one preset, not the whole app | Same templates and renderer serve every kind; only the short per-kind rule block in the prompt changes. |
| How the AI builds the video | **Storyboard JSON → built-in scene templates**; optional AI-written HTML scene, sandboxed | Smallest token use, works with small local models, no AI-written shell commands ever run. |
| Local model | `gemma4:12b-it-qat` via Ollama (already installed, runs as a brew service) | Largest current model that fits a 16GB M2 alongside the app. Tested: valid storyboard JSON, ~10 tok/s, ~50s per storyboard. Fallbacks: `qwen3:8b`, `ministral-3:8b`. |
| Render stack | Offscreen Electron `BrowserWindow` → frames → ffmpeg → MP4 | No Playwright, no Remotion (Remotion needs a paid license for companies over 3 people). |

## Hard rules (carry through every milestone)

1. **Minimum tokens on paid providers.** Short videos: one generation call. Long-form: one outline call + one call per section (each section sees only the outline + its slice of the brief). Compact brief (≤ ~800 tokens) instead of raw HTML. Short system prompt. Output constrained to a JSON schema. No images sent to paid providers unless the user turns it on. On invalid output, re-ask only for the broken scene with the validation error — never regenerate everything.
2. **Never invent claims.** No made-up numbers, stats, testimonials or awards. (The gemma test invented "92% success rate".) Enforce in code: any digit-containing headline in a `stat` scene and any `quote` text must appear in the source brief, else swap the scene to `feature`. Voiceover lines get the same number check (a number not in the brief → re-ask for that line).
3. **No AI code outside the sandbox.** AI-written HTML runs only in a render window with `contextIsolation`, no `nodeIntegration`, no preload, and a CSP that blocks all network. It never touches the shell or filesystem.
4. **Every frame is a pure function of time.** Scenes render from `t` (seconds), never from wall-clock animation, so capture is deterministic.
5. **No secrets in output.** API keys are stored with Electron `safeStorage`, never logged, never put into prompts, plans or videos.

## Architecture

```
src/
  main/                    Node side (Electron main process)
    index.ts               window + IPC registration
    providers/             one file per provider, all implement Provider
      types.ts             interface Provider { id; generate(req): Promise<string> }
      ollama.ts            POST localhost:11434/api/chat, format = JSON schema, think:false
      anthropic.ts         Messages API (default model: Haiku tier)
      gemini.ts            Gemini API (default: Flash tier; free tier exists)
      openai.ts            Chat/Responses API
      cli.ts               spawns `claude -p --output-format json`, `gemini -p`, `codex exec` (uses the user's subscription login)
    extract/brief.ts       hidden BrowserWindow loads URL → runs extractor → compact Brief
    extract/files.ts       attachments → text (pdfjs-dist, mammoth) + image metadata → merged into the Brief
    generate/
      prompt.ts            system prompt (short) + brief → request
      schema.ts            zod Storyboard schema (single source of truth; also emitted as JSON schema for providers)
      validate.ts          schema check, duration sum, no-invented-claims check, per-scene repair
    render/
      capture.ts           offscreen window, seek(t) → capturePage() → PNG stream
      ffmpeg.ts            pipe frames + audio into ffmpeg → mp4; poster frame 0
      audio.ts             receives WAV rendered by the player (see music); mixes music + voiceover
    tts/                   one file per TTS engine, all implement Tts { id; voices(); speak(text, voice): Promise<WAV> }
      kokoro.ts            kokoro-js, model downloaded once to app data
      openai.ts, gemini.ts, elevenlabs.ts
    store.ts               settings + encrypted keys (safeStorage) + chats, storyboard versions, memory packs (JSON files)
    generate/patch.ts      follow-up message → patch of changed scenes → validate → apply
  preload/index.ts         typed, minimal IPC bridge (contextBridge)
  renderer/                React UI
    src/App.tsx            input → provider picker → generate → preview → render
    src/player/            the video "engine": Storyboard + t → DOM
      Player.tsx           mounts scenes, exposes window.__seek(t) and window.__ready()
      scenes/              Title, Feature, Stat, Quote, Screenshot, List, LogoReveal, Cta, Custom
      transitions.ts       fade, slide, wipe, zoom, cut (staggered, never muddy crossfades)
      music.ts             procedural soundtrack via OfflineAudioContext → WAV
```

The **same Player** is used for the live preview in the UI and for capture in the offscreen render window: what you preview is what you get.

## UI

**Chat-first app.** YouTube is only *visual* inspiration (dark surfaces, video thumbnails as the main object, pill chips, rounded cards, chapter-style scrubber) — the app itself is built around chats, not a video site.

- **Layout:** left sidebar = chat list (each chat shows its latest video's poster as a thumbnail) + Memory + Settings. Main area = the chat. A video appears in the chat as a card with the Player; clicking it opens a side panel with the full preview, scene list and chips (kind, tone, format, voice).
- **Chat turns edit, not regenerate.** First message → storyboard. Follow-ups ("shorter", "punchier hook", "swap scene 3 for a stat") → one small call returning a **patch** (changed scenes only) applied to the current storyboard. Each patch is a version; user can go back.
- **Look:** own accent color, own font (e.g. Inter or Geist), dark by default with light mode, all theme values in shadcn CSS variables. Nothing YouTube-branded.

## Attachments

Drag-and-drop, paste, or a paperclip button in the chat input. Files are copied into the chat's folder (originals never modified) and shown as chips/thumbnails on the message.

- **Images** (png, jpg, webp, gif, svg): become assets the storyboard can use (`logo`, `screenshot`, `custom` backgrounds) and feed palette extraction. Sent as images to a model **only** if it's local, or if the user turned on "send images" for a paid provider (rule 1). The AI sees a one-line description per image (filename, size, user caption) otherwise.
- **Documents** (txt, md, pdf, docx, csv, json): text extracted locally (`pdfjs-dist` for PDF, `mammoth` for DOCX, plain read for the rest) → added to the brief as source material, compacted to the same token budget as a URL brief; long-form can take more, split per section. Counts as source for rule 2.
- **Limits:** per-file size cap (e.g. 20 MB images, 50 MB documents), max ~10 attachments per message, unsupported types rejected with a clear message.
- **Safety:** attachments are data, never instructions: document text goes into the prompt inside a clearly marked source block, and output is still schema-constrained. Nothing is executed; SVGs render only via `<img>` (no scripts). The Player loads attachments through a custom read-only `app-asset://` protocol scoped to the chat folder, not through `file://`.
- **Memory:** a chat's attachments stay with the chat; a logo or brand image can be saved into a memory pack and reused in other chats.
- **Later:** video clips as scene footage (seekable `<video>` with `currentTime = t`), audio files as a music bed.

## Memory

- **Per chat:** each chat keeps a compact memory: brand (palette, fonts, logo, name), voice + tone + format choices, source facts from the brief, and notes the user pinned ("never say 'AI-powered'", "our CTA is 'Join the waitlist'"). Filled automatically from choices and edits, plus explicit "remember this" — **no extra AI call** to maintain it.
- **Transfer between chats:** any memory item or the whole chat memory can be saved as a **memory pack** in a Memory library and attached to another chat (or a new chat can start from an existing one's memory). Packs are plain JSON, so they can also be exported/imported.
- **Token budget:** memory goes into the prompt as a short block (cap ~300 tokens; oldest/unpinned items dropped first). Full chat history is never resent — only memory + current storyboard + the new message.
- **Claims rule:** pinned user notes and attached packs count as source material for rule 2.
- **Storage:** one JSON file per chat and per pack under the app data folder (`store.ts`); API keys stay separate in safeStorage and are never put in memory.

## Motion

Use **Motion** (motion.dev, MIT) for both app UI animation and scene animation in the Player. To keep rule 4, the Player never lets Motion run on its own clock: scenes derive every style from a single time `MotionValue` (`useTransform` + Motion's easing/`mix` helpers), and `__seek(t)` just sets that value. Preview plays by advancing `t` with requestAnimationFrame; render sets `t` per frame. Same code path, so preview = output. No `animate()` timelines or layout animations inside scenes (they're wall-clock based).

## Data flow

1. User enters URL and/or text, picks kind, tone (`default`, `polished`, `yc-parody`, `chaotic`, `deadpan`, `cinematic`, `app-store`), format (landscape 1920×1080 / vertical 1080×1920 / square 1080×1080), duration (default 20s, min 5s, max 10 min), provider + model.
2. `extract/brief.ts` (URL only): load in hidden window, dismiss overlays, scroll to trigger lazy content, then collect title, meta/og tags, headings, CTAs, testimonials, the first ~N words of key copy, colors from computed styles, loaded font families, logo/og-image URLs. Optional screenshot for vision models (local by default only).
3. `generate` (when voiceover is on, the AI also writes a `voiceover` line per scene, within a word budget of ~2.5 words per second of scene): short → one call → Storyboard JSON. Long-form → outline call (sections with title, goal, durationSec, which brief parts) → one call per section → merged Storyboard. Then validate → repair broken scenes only.
4. `voiceover` (if on): synthesize each scene's line → measure its length → if a line is longer than its scene, stretch that scene (and the total) rather than speed up speech; never cut words. Cache audio per (text, voice, engine) so edits only re-synthesize changed lines.
5. UI shows the storyboard as editable cards + live preview. User can edit text or re-roll one scene (one small call).
6. `render`: offscreen window at exact output size; frames stream straight to ffmpeg, never held in memory (10 min = 18,000 frames). Long videos render in ~60s chunks to separate files then join with ffmpeg concat, so a crash resumes at the last chunk and progress/ETA are real. For each frame `__seek(t)`, wait for fonts/images, `capturePage()`, pipe to ffmpeg (`-f image2pipe`, 30fps, H.264, yuv420p). Music WAV mixed in; with voiceover, voice clips are placed at each scene's start (+0.3s) and music is ducked under the voice. Poster = strongest settled frame, baked as frame 0.
7. Output folder: `video.mp4`, `poster.jpg`, `share-copy.txt`, `storyboard.json`, and with voiceover `captions.srt` (timings come free from the scene layout).

## Storyboard schema (draft)

```ts
{
  title: string,
  kind: Kind,
  tone: Tone,
  palette: { bg: hex, fg: hex, accent: hex },
  font: { heading: string, body: string },        // from the site when available
  voice?: { engine: string, voice: string, speed: number },
  music: { bpm: 70-160, mood: 'bright'|'dark'|'calm'|'epic'|'quirky', key: string },
  scenes: Array<{
    template: 'title'|'text'|'feature'|'stat'|'quote'|'screenshot'|'list'|'step'|'logo'|'cta'|'custom',
    section?: string,                 // long-form only: which outline section it belongs to
    durationSec: number,              // sum must equal target duration ±0.1
    headline: string, sub?: string, items?: string[],
    asset?: string,                   // key into brief assets (logo, screenshot, attached image id)
    transitionIn: 'fade'|'slide'|'wipe'|'zoom'|'cut',
    voiceover?: string,               // narration for this scene; may say more than the on-screen text, never contradicts it
    html?: string                     // only for 'custom', only if the user enabled AI scenes
  }>,
  shareCopy: string                   // caption for posting: 1–3 sentences, no "excited to share"
}
```

System prompt = shared rules + one short block for the chosen kind.

- **Shared (all kinds):** hook in the first 2s; clear to a stranger; use the source's own words; no generic filler phrases; text on screen ≥ 0.3s per word once fully visible; ~4–6s per scene (60s ≈ 10–14 scenes, 10 min ≈ 100–150 scenes); long-form gets section title cards and should not repeat the same template more than twice in a row.
- **launch** (from brag-slim): Hook → Reveal → 2–3 highlights → punchline/CTA.
- **explainer:** problem → idea → how it works (2–4 beats) → takeaway.
- **announcement:** the news → why it matters → details (date/where/who) → what to do.
- **tutorial:** goal → numbered `step` scenes → result.
- **promo:** hook → offer/event → details → CTA.
- **story:** setup → turn → payoff.
- **custom:** user's own description of the structure, no preset block.

## Music

v1: procedural, no samples, no dependencies. For long-form, the music changes pattern per section (intro/build/main/outro) so 10 minutes isn't one 8-bar loop. `music.ts` renders from `{bpm, mood, key}` with OfflineAudioContext (drums + bass + pad + a few hit sounds on scene cuts, in the same key), soft mix, fade out at the end. Rendered once per video to WAV and handed to ffmpeg. Later: royalty-free track packs.

## Milestones

Each milestone ends with something you can run. Do them in order.

1. **Render pipeline proof.** Hard-coded storyboard JSON → Player with 2 scene templates → offscreen capture → ffmpeg → MP4. Uses system ffmpeg for now. *Done when:* a 10s MP4 plays and `ffprobe` reports the right duration and size. Also time a 10-min render of the same scenes and record frames/sec — this decides whether long-form needs a faster capture path.
2. **Schema + all templates + transitions + tones + formats.** zod schema, every template, staggered transitions, 3 formats. Scenes animated with Motion via the time MotionValue. Set up shadcn + theme tokens + the chat shell (sidebar, chat view, video card, preview side panel with scrubber).
3. **Ollama provider + text input + kinds.** Prompt → storyboard → validate/repair → preview → render. *Done when:* "a 20s launch video for X" and "a 20s explainer about Y" each produce a video end to end with zero paid tokens.
4. **URL brief extractor.** Hidden-window extraction → compact brief. Log the brief's token estimate; keep it under ~800 for short videos. Long-form can take more source text (multiple pages, pasted docs), split into parts the outline assigns to sections.
4a. **Attachments.** Drag/drop/paste/picker, copy into chat folder, `app-asset://` protocol, PDF/DOCX/text extraction into the brief, images as scene assets. *Done when:* a PDF + a logo attached to a chat produce a video that uses the PDF's facts and shows the logo.
4b. **Long-form.** Outline → per-section generation, section-level re-roll, chunked render + concat with resume. *Done when:* a 10-min video renders end to end on Ollama.
5. **Music.** Procedural soundtrack, mixed into the MP4.
5b. **Voiceover.** Kokoro TTS + per-scene `voiceover` lines + scene stretching + music ducking + `captions.srt`; voice picker with preview. *Done when:* a narrated 60s video renders with voice in sync and `ffprobe` shows one mixed audio stream.
6. **Other providers.** Anthropic, Gemini, OpenAI (API keys via safeStorage) + CLI provider (`claude`, `gemini`, `codex`). Show token usage per generation in the UI. Paid TTS engines (OpenAI, Gemini, ElevenLabs) with a cost estimate shown before synthesis.
7. **AI custom scenes (opt-in).** Sandboxed HTML scene with CSP; on any error or timeout, fall back to a template scene.
8. **Polish.** Chat memory + memory packs (save, attach, export/import), patch-based follow-up edits with version history, chapter-segment scrubber, editable storyboard cards, re-roll one scene, poster frame, share copy, output folder button, progress bar during render.
9. **Packaging.** electron-builder for macOS (then Windows/Linux), bundled ffmpeg (check ffmpeg-static's LGPL/GPL terms before selling), code signing + notarization.

Later (not v1): project-folder input, Claude plugin / desktop extension (MCP), remote connector for Claude mobile, hosted paid web version with sandboxed render workers.

## Testing

- **vitest** for pure logic: schema validation, duration-sum check, no-invented-claims check, repair loop, brief compaction, provider response parsing (with recorded fixtures, no live calls).
- **Render smoke test:** fixed storyboard → MP4 → `ffprobe` asserts duration, resolution, fps, audio stream present.
- vitest for attachments: text extraction from fixture PDF/DOCX, brief compaction with attachments, size/type rejection, asset protocol refuses paths outside the chat folder.
- vitest for memory/chat logic: memory token cap + drop order, pack export/import round-trip, patch apply + validation.
- vitest for voiceover logic: word-budget check, scene stretching, SRT timings, cache keys.
- **Manual eval set:** 5 real URLs/descriptions × 3 kinds on gemma4; keep the outputs to compare when changing prompts or models.

## Dev notes

- `pnpm dev` starts the app with hot reload. `pnpm typecheck`, `pnpm lint`, `pnpm build:mac` come from the template.
- Ollama: `brew services start ollama`; model: `ollama pull gemma4:12b-it-qat`; test: `curl localhost:11434/api/tags`.
- ffmpeg is installed via Homebrew at `/opt/homebrew/bin/ffmpeg` (dev only; bundle it in milestone 9).
- Reference material: `../brag/skills/brag-slim/SKILL.md` (creative rules, tones, sound guidance).
- Milestone 1 measured (M2 16GB, 1080p, 2 simple scenes): 28.4 fps capture+encode → a 10-min video renders in ~10.5 min. Smoke test: `LR_RENDER=1 pnpm dev` prints the MP4 path.
