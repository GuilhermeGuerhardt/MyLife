import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
// A Inter vem empacotada, não do Google: um programa instalado não deve
// depender de rede para desenhar o próprio texto.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
