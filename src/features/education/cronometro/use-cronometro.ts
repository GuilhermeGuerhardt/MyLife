/**
 * O cronômetro de estudo que atravessa as telas.
 *
 * Mora no armazenamento da máquina, e não em estado de componente: começar a
 * estudar em Faculdade e ir conferir o Caderno não pode zerar nada, e fechar o
 * app sem querer também não. A aba ou janela que mudar o cronômetro avisa as
 * outras, e todas mostram o mesmo relógio.
 */

import { useSyncExternalStore } from 'react'
import { useStudySessions } from '@/data/queries'
import {
  MINUTOS_MINIMOS,
  iniciar,
  interpretarCronometro,
  minutosParaGravar,
  pausar,
  retomar,
  type AlvoDoEstudo,
  type EstadoDoCronometro,
} from '@/lib/education/cronometro'
import { today } from '@/lib/utils'

const CHAVE = 'life:cronometro'
const EVENTO = 'life:cronometro-mudou'

// O `useSyncExternalStore` exige a mesma referência enquanto nada mudou; sem o
// cache, cada leitura devolveria um objeto novo e a tela entraria em laço.
let ultimoCru: string | null = null
let ultimoEstado: EstadoDoCronometro | null = null

function ler(): EstadoDoCronometro | null {
  let cru: string | null = null
  try {
    cru = localStorage.getItem(CHAVE)
  } catch {
    return null
  }
  if (cru !== ultimoCru) {
    ultimoCru = cru
    ultimoEstado = interpretarCronometro(cru)
  }
  return ultimoEstado
}

function gravar(estado: EstadoDoCronometro | null): void {
  try {
    if (estado) localStorage.setItem(CHAVE, JSON.stringify(estado))
    else localStorage.removeItem(CHAVE)
  } catch {
    // Sem armazenamento, o cronômetro não sobrevive a recarregar a tela.
  }
  window.dispatchEvent(new Event(EVENTO))
}

function assinar(aoMudar: () => void): () => void {
  // `storage` chega das outras abas e janelas; o evento próprio, desta.
  window.addEventListener('storage', aoMudar)
  window.addEventListener(EVENTO, aoMudar)
  return () => {
    window.removeEventListener('storage', aoMudar)
    window.removeEventListener(EVENTO, aoMudar)
  }
}

/** Um encerramento por vez: dois cliques rápidos em "Encerrar" gravariam o estudo duas vezes. */
let encerrando = false

export function useCronometro() {
  const estado = useSyncExternalStore(assinar, ler)
  const { create } = useStudySessions()

  /** Grava o estudo e desliga. Devolve os minutos gravados (zero se foi curto demais). */
  async function encerrar(): Promise<{ minutos: number; rotulo: string } | null> {
    const atual = ler()
    if (!atual || encerrando) return null
    encerrando = true
    try {
      const minutos = minutosParaGravar(atual, Date.now())
      // Grava antes de desligar: se a gravação falhar, o cronômetro continua
      // ali e o tempo não se perde.
      if (minutos >= MINUTOS_MINIMOS) {
        await create.mutateAsync({
          program_id: atual.program_id,
          subject_id: atual.subject_id,
          date: atual.dia,
          minutes: minutos,
          notes: null,
          deleted_at: null,
        })
      }
      gravar(null)
      return { minutos: minutos >= MINUTOS_MINIMOS ? minutos : 0, rotulo: atual.rotulo }
    } finally {
      encerrando = false
    }
  }

  /**
   * Começa a estudar. Se outro cronômetro estava correndo, ele é encerrado e
   * gravado antes: trocar de matéria é o fim de um estudo, não o descarte dele.
   */
  async function comecar(alvo: AlvoDoEstudo) {
    // O modo Pomodoro passa para o próximo: quem estuda assim troca de matéria
    // sem querer religar a cada vez.
    const pomodoro = ler()?.pomodoro ?? false
    const anterior = ler() ? await encerrar() : null
    gravar(iniciar(alvo, Date.now(), today(), pomodoro))
    return anterior
  }

  return {
    estado,
    comecar,
    encerrar,
    pausar: () => {
      const atual = ler()
      if (atual) gravar(pausar(atual, Date.now()))
    },
    retomar: () => {
      const atual = ler()
      if (atual) gravar(retomar(atual, Date.now()))
    },
    alternarPomodoro: () => {
      const atual = ler()
      if (atual) gravar({ ...atual, pomodoro: !atual.pomodoro })
    },
    descartar: () => gravar(null),
  }
}
