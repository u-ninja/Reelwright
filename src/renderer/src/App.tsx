import { useState } from 'react'
import { Player } from './player/Player'
import { demo, duration } from './player/storyboard'

function App(): React.JSX.Element {
  const [t, setT] = useState(0)
  const [status, setStatus] = useState('')
  const render = async (): Promise<void> => {
    setStatus('Rendering…')
    try {
      setStatus(`Saved ${await window.electron.ipcRenderer.invoke('render')}`)
    } catch (e) {
      setStatus(String(e))
    }
  }
  return (
    <main className="flex h-screen flex-col items-center justify-center gap-4 bg-neutral-950 text-neutral-100">
      <div className="h-[270px] w-[480px] overflow-hidden rounded-xl">
        <div className="origin-top-left scale-25">
          <Player sb={demo} t={t} />
        </div>
      </div>
      <input
        type="range"
        aria-label="Time"
        className="w-[480px]"
        min={0}
        max={duration(demo)}
        step={1 / 30}
        value={t}
        onChange={(e) => setT(+e.target.value)}
      />
      <button className="rounded-full bg-neutral-100 px-5 py-2 text-neutral-950" onClick={render}>
        Render MP4
      </button>
      <p className="text-sm text-neutral-400">{status}</p>
    </main>
  )
}

export default App
