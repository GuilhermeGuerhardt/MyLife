import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { aplicarDestinoDaJanela } from './lib/destino-da-janela'
// A Inter vem empacotada, não do Google: um programa instalado não deve
// depender de rede para desenhar o próprio texto.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
// A serifa do título e do número. Dois pesos só: o texto corrido continua na
// Inter, e a serifa é o contraponto, não a fonte da casa.
import '@fontsource/source-serif-4/400.css'
import '@fontsource/source-serif-4/600.css'
import './index.css'

// Antes do primeiro render: a janela aberta pelo app carrega `index.html` com
// o destino no endereço, e o roteador precisa já encontrar a rota certa.
aplicarDestinoDaJanela()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
