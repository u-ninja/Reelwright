import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { RenderRoot } from './player/Player'
import { demo } from './player/storyboard'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{location.hash === '#render' ? <RenderRoot sb={demo} /> : <App />}</StrictMode>
)
