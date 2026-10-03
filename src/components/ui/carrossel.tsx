import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface Slide {
  id: string
  /** Nome curto, usado no rótulo do ponto e para leitor de tela. */
  titulo: string
  conteudo: ReactNode
}

/** Tempo parado em cada painel. Curto demais vira anúncio de aeroporto. */
const INTERVALO = 9000

/**
 * Um painel por vez, com os outros a um clique.
 *
 * Serve para o que é consulta ocasional: o comprometido dos próximos meses, a
 * fatura que vem, a meta. Cada um desses mereceria um cartão fixo, mas sete
 * cartões fixos viram uma tela que ninguém lê — e o olho já aprendeu a pular
 * tudo que parece painel cheio.
 *
 * Passa sozinho, devagar, e para assim que o ponteiro ou o teclado chega perto:
 * quem está lendo não pode ter o conteúdo trocado embaixo do dedo. Quem pediu
 * menos animação no sistema não vê troca automática nenhuma.
 */
export function Carrossel({ slides, className }: { slides: Slide[]; className?: string }) {
  const [atual, setAtual] = useState(0)
  const [parado, setParado] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  const total = slides.length
  const indice = Math.min(atual, Math.max(total - 1, 0))

  useEffect(() => {
    if (total < 2 || parado) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const id = setInterval(() => setAtual((anterior) => (anterior + 1) % total), INTERVALO)
    return () => clearInterval(id)
  }, [total, parado])

  if (total === 0) return null

  const ir = (passo: number) => setAtual((anterior) => (anterior + passo + total) % total)

  return (
    <div
      ref={caixa}
      onMouseEnter={() => setParado(true)}
      onMouseLeave={() => setParado(false)}
      onFocusCapture={() => setParado(true)}
      onBlurCapture={(evento) => {
        if (!caixa.current?.contains(evento.relatedTarget as Node)) setParado(false)
      }}
      onKeyDown={(evento) => {
        if (evento.key === 'ArrowRight') ir(1)
        if (evento.key === 'ArrowLeft') ir(-1)
      }}
    >
      <Card
        className={cn('overflow-hidden', className)}
        role="group"
        aria-roledescription="carrossel"
        tabIndex={-1}
      >
        <div
          key={slides[indice]!.id}
          className="animate-[var(--animate-in)]"
          aria-live="polite"
          aria-label={`${slides[indice]!.titulo} (${indice + 1} de ${total})`}
        >
          {slides[indice]!.conteudo}
        </div>

        {total > 1 && (
          <div className="border-border-base flex items-center justify-between gap-3 border-t px-3 py-2">
            <button
              type="button"
              onClick={() => ir(-1)}
              aria-label="Painel anterior"
              className="text-fg-subtle hover:text-fg transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>

            {/* Os pontos dizem o nome do painel: quem procura "a fatura que vem"
                não precisa esperar a roda passar por ela. */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {slides.map((slide, posicao) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setAtual(posicao)}
                  aria-label={slide.titulo}
                  aria-current={posicao === indice}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    posicao === indice ? 'bg-fg-muted w-5' : 'bg-border-strong w-1.5',
                  )}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => ir(1)}
              aria-label="Próximo painel"
              className="text-fg-subtle hover:text-fg transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}
