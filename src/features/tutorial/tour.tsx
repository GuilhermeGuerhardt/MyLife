import { X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { posicionarBalao, recorte, vale, type Retangulo } from './foco'
import type { Tutorial } from './conteudo'

/** Largura do balão. Fixa, para a conta de posição não depender do texto. */
const LARGURA = 320

function medir(seletor: string | undefined): Retangulo | null {
  if (!seletor) return null
  const alvo = document.querySelector(seletor)
  if (!alvo) return null
  const caixa = alvo.getBoundingClientRect()
  return { top: caixa.top, left: caixa.left, width: caixa.width, height: caixa.height }
}

/**
 * O guia passo a passo, com o holofote no que está sendo explicado.
 *
 * O cartão parado no topo da tela dizia o que existe; aqui a pessoa vê onde
 * está. Cada passo pode apontar para um elemento de verdade, e o que fala de um
 * conceito em vez de um botão aparece centrado, sem seta para lugar nenhum.
 *
 * O passo cujo alvo não existe naquela tela não vira um buraco no vazio: ele
 * perde o holofote e vira cartão centrado. É o que acontece com o menu lateral
 * no celular, que existe no código e não na tela.
 *
 * Sem biblioteca de tour. São um retângulo medido, uma sombra gigante fazendo o
 * escuro em volta e um cartão posicionado — e uma biblioteca disso traz consigo
 * um jeito próprio de escrever passo, que brigaria com o conteúdo que já está
 * em `conteudo.ts`.
 */
export function TourGuiado({
  tutorial,
  onFim,
  onPular,
}: {
  tutorial: Tutorial
  onFim: () => void
  onPular: () => void
}) {
  const [passo, setPasso] = useState(0)
  const [alvo, setAlvo] = useState<Retangulo | null>(null)
  const [altura, setAltura] = useState(180)
  const balao = useRef<HTMLDivElement>(null)

  const atual = tutorial.passos[passo]
  const total = tutorial.passos.length
  const ultimo = passo === total - 1

  const remedir = useCallback(() => setAlvo(medir(atual?.alvo)), [atual?.alvo])

  // O alvo pode estar fora da vista: traz para perto antes de medir.
  useLayoutEffect(() => {
    if (!atual?.alvo) {
      setAlvo(null)
      return
    }
    document.querySelector(atual.alvo)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const parado = setTimeout(remedir, 320)
    remedir()
    return () => clearTimeout(parado)
  }, [atual?.alvo, remedir])

  useLayoutEffect(() => {
    if (balao.current) setAltura(balao.current.offsetHeight)
  }, [passo])

  useEffect(() => {
    window.addEventListener('resize', remedir)
    window.addEventListener('scroll', remedir, true)
    return () => {
      window.removeEventListener('resize', remedir)
      window.removeEventListener('scroll', remedir, true)
    }
  }, [remedir])

  useEffect(() => {
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onPular()
      if (evento.key === 'ArrowRight') setPasso((p) => Math.min(p + 1, total - 1))
      if (evento.key === 'ArrowLeft') setPasso((p) => Math.max(p - 1, 0))
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onPular, total])

  if (!atual) return null

  const comFoco = vale(alvo)
  const buraco = comFoco ? recorte(alvo) : null
  const largura = Math.min(LARGURA, window.innerWidth - 32)
  const posicao = posicionarBalao(comFoco ? alvo : null, { largura, altura }, {
    largura: window.innerWidth,
    altura: window.innerHeight,
  })

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={tutorial.titulo}>
      {/*
        Duas camadas de propósito. A de baixo cobre a tela inteira e engole o
        clique: o escuro do holofote é sombra pintada, não superfície, e sem
        esta camada dá para clicar no menu por baixo do guia e sair andando pelo
        app com ele aberto. A de cima é só o desenho do buraco, e não recebe
        clique nenhum.
      */}
      <div
        className={cn('absolute inset-0', !buraco && 'bg-black/55')}
        onClick={(evento) => evento.stopPropagation()}
      />

      {buraco && (
        <div
          aria-hidden
          className="ring-accent pointer-events-none absolute rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] ring-2 transition-[top,left,width,height] duration-200"
          style={{ top: buraco.top, left: buraco.left, width: buraco.width, height: buraco.height }}
        />
      )}

      <div
        ref={balao}
        className="bg-surface absolute rounded-[var(--radius-card)] p-4 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)]"
        style={{ top: posicao.top, left: posicao.left, width: largura }}
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <p className="text-fg-subtle text-[11px] font-medium">
            {tutorial.titulo} · {passo + 1} de {total}
          </p>
          <button
            type="button"
            onClick={onPular}
            aria-label="Pular o guia"
            className="text-fg-subtle hover:text-fg -mt-1 -mr-1 shrink-0 transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <h2 className="text-fg text-sm font-semibold">{atual.titulo}</h2>
        <p className="text-fg-muted mt-1 text-sm leading-relaxed">{atual.texto}</p>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex flex-1 gap-1" aria-hidden>
            {tutorial.passos.map((item, indice) => (
              <span
                key={item.titulo}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  indice <= passo ? 'bg-accent' : 'bg-border-base',
                )}
              />
            ))}
          </div>

          {passo > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setPasso(passo - 1)}>
              Voltar
            </Button>
          )}
          <Button size="sm" onClick={() => (ultimo ? onFim() : setPasso(passo + 1))}>
            {ultimo ? 'Entendi' : 'Próximo'}
          </Button>
        </div>
      </div>
    </div>
  )
}
