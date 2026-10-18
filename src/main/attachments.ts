import { nativeImage } from 'electron'
import { createHash } from 'crypto'
import { createReadStream, existsSync } from 'fs'
import { copyFile, readFile, stat, writeFile } from 'fs/promises'
import { extname, join } from 'path'
import { Readable } from 'stream'
import type { Attachment } from '../shared/schema'
import { dir, mediaDuration } from './audio'

// Allowed types and their size cap in MB.
const TYPES: Record<string, [Attachment['kind'], number]> = {
  '.png': ['image', 20],
  '.jpg': ['image', 20],
  '.jpeg': ['image', 20],
  '.webp': ['image', 20],
  '.gif': ['image', 20],
  '.svg': ['image', 20],
  '.mp4': ['video', 500],
  '.mov': ['video', 500],
  '.webm': ['video', 500],
  '.m4v': ['video', 500],
  '.pdf': ['doc', 50],
  '.docx': ['doc', 50],
  '.txt': ['doc', 50],
  '.md': ['doc', 50],
  '.csv': ['doc', 50],
  '.json': ['doc', 50]
}
const DOC_CHARS = 6000 // per document, keeps the prompt small

// Trust boundary: only known types under their size cap get in.
export function checkFile(name: string, bytes: number): Attachment['kind'] {
  const t = TYPES[extname(name).toLowerCase()]
  if (!t) throw new Error(`${name}: unsupported file type`)
  if (bytes > t[1] * 1024 * 1024) throw new Error(`${name}: larger than ${t[1]} MB`)
  return t[0]
}

// app-asset://file/<16 hex>.<ext> → a file inside the asset store, or null. The strict name
// pattern means no path can ever escape the store.
export function assetFile(url: string): string | null {
  const m = url.match(/^app-asset:\/\/file\/([a-f0-9]{16}\.[a-z0-9]{2,5})$/)
  return m ? join(dir('assets'), m[1]) : null
}

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm'
}

// "bytes=100-" / "bytes=100-199" / "bytes=-500" → inclusive [start, end] within size, or null if unusable.
export function byteRange(header: string | null, size: number): [number, number] | null {
  const m = header?.match(/^bytes=(\d*)-(\d*)$/)
  if (!m || (!m[1] && !m[2])) return null
  const start = m[1] ? +m[1] : Math.max(0, size - +m[2])
  const end = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1
  return start <= end ? [start, end] : null
}

// app-asset:// handler with Range support, which <video> needs to seek.
export async function serveAsset(req: Request): Promise<Response> {
  const file = assetFile(req.url)
  if (!file || !existsSync(file)) return new Response('not found', { status: 404 })
  const size = (await stat(file)).size
  const type = MIME[extname(file)] ?? 'application/octet-stream'
  const r = byteRange(req.headers.get('range'), size)
  const [start, end] = r ?? [0, size - 1]
  const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream
  const headers: Record<string, string> = {
    'content-type': type,
    'content-length': String(end - start + 1),
    'accept-ranges': 'bytes'
  }
  if (r) headers['content-range'] = `bytes ${start}-${end}/${size}`
  return new Response(body, { status: r ? 206 : 200, headers })
}

async function extractText(path: string, ext: string): Promise<string> {
  if (ext === '.pdf') {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await readFile(path)) }).promise
    const pages: string[] = []
    for (let i = 1; i <= Math.min(doc.numPages, 30); i++) {
      const c = await (await doc.getPage(i)).getTextContent()
      pages.push(c.items.map((it) => ('str' in it ? it.str : '')).join(' '))
    }
    return pages.join('\n')
  }
  if (ext === '.docx') return (await (await import('mammoth')).extractRawText({ path })).value
  return readFile(path, 'utf8')
}

// shortcut: kept in memory for this session; persisted with chats in milestone 8.
const registry = new Map<string, Attachment>()
export const getAttachment = (id: string): Attachment | undefined => registry.get(id)

// Copy a file (by path, or raw bytes for pasted screenshots) into the content-addressed store
// and describe it for the AI. Originals are never modified.
export async function attach(input: {
  name: string
  path?: string
  data?: Uint8Array
}): Promise<Attachment> {
  const ext = extname(input.name).toLowerCase()
  const kind = checkFile(
    input.name,
    input.path ? (await stat(input.path)).size : (input.data?.length ?? 0)
  )
  const h = createHash('sha1')
  if (input.data) h.update(input.data)
  else for await (const chunk of createReadStream(input.path!)) h.update(chunk)
  const id = h.digest('hex').slice(0, 16)
  const file = join(dir('assets'), id + ext)
  if (!existsSync(file))
    await (input.data ? writeFile(file, input.data) : copyFile(input.path!, file))

  const url = `app-asset://file/${id}${ext}`
  let info: string = kind
  let text: string | undefined
  if (kind === 'image') {
    const { width, height } = nativeImage.createFromPath(file).getSize()
    if (width) info = `image ${width}x${height}`
  } else if (kind === 'video') {
    info = `video ${(await mediaDuration(file)).toFixed(1)}s`
  } else {
    text = (await extractText(file, ext)).replace(/\s+/g, ' ').trim().slice(0, DOC_CHARS)
    info = `document, ${text.split(' ').length} words`
  }
  const a: Attachment = { id, name: input.name, kind, url, info, text }
  registry.set(id, a)
  return a
}
