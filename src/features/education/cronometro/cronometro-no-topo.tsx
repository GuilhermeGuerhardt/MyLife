/**
 * O cronômetro correndo, no cabeçalho de todas as telas.
 *
 * No topo, e não flutuando sobre a página: um relógio flutuante cobre o fim da
 * lista que a pessoa está lendo, e ficaria por cima da barra de seleção no
 * celular. No cabeçalho ele ocupa um lugar que já é de controles.
 */

import { Pause, Play, Square, Timer, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ehJanelaSecundaria } from '@/components/layout/janela-solta'
import { Toast, ToastArea } from '@/components/ui/toast'
import { confirmar } from '@/lib/avisos'
import {
  decorrido,
  faseDoPomodoro,
  formatarCronometro,
  tempoDeEstudo,
} from '@/lib/education/cronometro'
import { duration } from '@/lib/format'
import { notificar } from '@/lib/notificacao'
import { cn } from '@/lib/utils'
import { useCronometro } from './use-cronometro'

/** O relógio da tela: anda de segundo em segundo só enquanto o cronômetro corre. */
function useAgora(correndo: boolean): number {
  const [agora, setAgora] = useState(Date.now)
  useEffect(() => {
    if (!correndo) return
    setAgora(Date.now())
    const id = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [correndo])
  return agora
}

const botao =
  'text-fg-subtle hover:text-fg flex size-7 items-center justify-center rounded transition-colors'

export function CronometroNoTopo() {
  const { estado, pausar, retomar, encerrar, descartar, alternarPomodoro } = useCronometro()
  const correndo = estado !== null && estado.desde !== null
  const agora = useAgora(correndo)
  const [registro, setRegistro] = useState<string | null>(null)

  // Aviso na troca de fase do Pomodoro: quem está concentrado não olha o
  // relógio, e é justamente o balão que lembra de parar e de voltar.
  const faseAnterior = useRef<string | null>(null)
  const pomodoro = estado?.pomodoro ? faseDoPomodoro(decorrido(estado, agora)) : null
  const chaveDaFase = correndo && pomodoro ? `${pomodoro.fase}-${pomodoro.ciclo}` : null
  useEffect(() => {
    const anterior = faseAnterior.current
    faseAnterior.current = chaveDaFase
    if (!chaveDaFase || !anterior || anterior === chaveDaFase || ehJanelaSecundaria()) return
    if (chaveDaFase.startsWith('pausa')) {
      void notificar('Pausa de 5 minutos', 'Ciclo de foco concluído. Levante, beba água.')
    } else {
      void notificar('De volta ao foco', 'Mais 25 minutos.')
    }
  }, [chaveDaFase])

  async function aoEncerrar() {
    const gravado = await encerrar()
    if (!gravado) return
    setRegistro(
      gravado.minutos > 0
        ? `${duration(gravado.minutos)} de ${gravado.rotulo} registrados.`
        : 'Menos de um minuto: nada foi registrado.',
    )
  }

  async function aoDescartar() {
    const ok = await confirmar('Descartar este tempo de estudo? Ele não será registrado.', {
      confirmar: 'Descartar',
    })
    if (ok) descartar()
  }

  const aviso = registro && (
    <ToastArea>
      <Toast title="Estudo encerrado" description={registro} onClose={() => setRegistro(null)} />
    </ToastArea>
  )

  if (!estado) return aviso || null

  const tempo = estado.pomodoro
    ? formatarCronometro(pomodoro!.restante)
    : formatarCronometro(tempoDeEstudo(estado, agora))

  return (
    <>
      <div
        role="timer"
        aria-label={`Estudando ${estado.rotulo}`}
        className="border-border-base bg-surface flex h-9 items-center gap-1 rounded-lg border pr-1 pl-2.5"
      >
        <span
          className={cn('size-1.5 shrink-0 rounded-full', correndo ? 'bg-accent' : 'bg-border-strong')}
          aria-hidden
        />
        <span className="text-fg-muted hidden max-w-36 truncate text-xs md:inline" title={estado.rotulo}>
          {estado.rotulo}
        </span>
        <span className="text-fg ml-1 text-sm font-medium tabular-nums">
          {pomodoro && (
            <span className="text-fg-subtle mr-1 text-xs font-normal max-sm:hidden">
              {pomodoro.fase === 'foco' ? 'foco' : 'pausa'}
            </span>
          )}
          {tempo}
        </span>

        <button
          type="button"
          className={botao}
          onClick={correndo ? pausar : retomar}
          aria-label={correndo ? 'Pausar cronômetro' : 'Continuar cronômetro'}
          title={correndo ? 'Pausar' : 'Continuar'}
        >
          {correndo ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </button>
        <button
          type="button"
          className={cn(botao, estado.pomodoro && 'text-accent hover:text-accent')}
          onClick={alternarPomodoro}
          aria-pressed={estado.pomodoro}
          aria-label="Modo Pomodoro: 25 minutos de foco e 5 de pausa"
          title="Pomodoro: 25 de foco, 5 de pausa"
        >
          <Timer className="size-3.5" />
        </button>
        <button
          type="button"
          className={botao}
          onClick={() => void aoEncerrar()}
          aria-label="Encerrar e registrar o estudo"
          title="Encerrar e registrar"
        >
          <Square className="size-3.5" />
        </button>
        <button
          type="button"
          className={cn(botao, 'max-sm:hidden')}
          onClick={() => void aoDescartar()}
          aria-label="Descartar o cronômetro"
          title="Descartar"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {aviso}
    </>
  )
}
