import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ nativeImage: {}, app: { getPath: () => '/tmp/reelwright-test' } }))
const { assetFile, byteRange, checkFile } = await import('./attachments')

describe('checkFile', () => {
  it('accepts known types under their cap', () => {
    expect(checkFile('Logo.PNG', 1024)).toBe('image')
    expect(checkFile('demo.mov', 100 * 1024 * 1024)).toBe('video')
    expect(checkFile('notes.pdf', 10)).toBe('doc')
  })
  it('rejects unknown types and oversized files', () => {
    expect(() => checkFile('run.exe', 1)).toThrow('unsupported')
    expect(() => checkFile('huge.png', 21 * 1024 * 1024)).toThrow('20 MB')
  })
})

describe('byteRange', () => {
  it('parses the range forms a video element sends', () => {
    expect(byteRange('bytes=0-', 1000)).toEqual([0, 999])
    expect(byteRange('bytes=100-199', 1000)).toEqual([100, 199])
    expect(byteRange('bytes=-200', 1000)).toEqual([800, 999])
    expect(byteRange('bytes=900-5000', 1000)).toEqual([900, 999])
  })
  it('ignores missing or unusable ranges', () => {
    expect(byteRange(null, 1000)).toBeNull()
    expect(byteRange('bytes=-', 1000)).toBeNull()
    expect(byteRange('bytes=1200-', 1000)).toBeNull()
  })
})

describe('assetFile', () => {
  it('serves only content-addressed names inside the store', () => {
    expect(assetFile('app-asset://file/0123456789abcdef.png')).toBe(
      '/tmp/reelwright-test/assets/0123456789abcdef.png'
    )
    expect(assetFile('app-asset://file/../secrets.txt')).toBeNull()
    expect(assetFile('app-asset://file/%2e%2e%2fetc.png')).toBeNull()
    expect(assetFile('app-asset://file/0123456789abcdef.png/../../x')).toBeNull()
  })
})
