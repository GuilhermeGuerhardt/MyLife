/**
 * O cronômetro de estudo, como dado.
 *
 * O estado guarda instantes, e não um contador que sobe a cada segundo: um
 * contador para quando a aba dorme, o computador hiberna ou a tela recarrega,
 * e a pessoa volta para um tempo menor do que estudou. Com o instante de
 * partida, o tempo decorrido é só uma subtração, e sobrevive a tudo isso.
 */

export interface EstadoDoCronometro {
  program_id: string | null
  subject_id: string | null
  /** O que a barra mostra: o nome da disciplina ou do curso. */
  rotulo: string
  /** Quando o trecho atual começou a correr, em ms. `null` = pausado. */
  desde: number | null
  /** Tempo corrido antes do trecho atual, em ms. */
  acumulado: number
  /** Dia em que começou. O estudo que passa da meia-noite fica no dia em que começou. */
  dia: string
  /** Ciclos de 25 minutos de foco e 5 de pausa. */
  pomodoro: boolean
}

export interface AlvoDoEstudo {
  program_id: string | null
  subject_id: string | null
  rotulo: string
}

export const FOCO_MS = 25 * 60_000
export const PAUSA_MS = 5 * 60_000
const CICLO_MS = FOCO_MS + PAUSA_MS

/** Menos que isto não vira registro: foi um clique sem querer, não um estudo. */
export const MINUTOS_MINIMOS = 1

export function iniciar(
  alvo: AlvoDoEstudo,
  agora: number,
  dia: string,
  pomodoro = false,
): EstadoDoCronometro {
  return { ...alvo, desde: agora, acumulado: 0, dia, pomodoro }
}

export function decorrido(estado: EstadoDoCronometro, agora: number): number {
  return estado.acumulado + (estado.desde === null ? 0 : Math.max(agora - estado.desde, 0))
}

export function pausar(estado: EstadoDoCronometro, agora: number): EstadoDoCronometro {
  if (estado.desde === null) return estado
  return { ...estado, acumulado: decorrido(estado, agora), desde: null }
}

export function retomar(estado: EstadoDoCronometro, agora: number): EstadoDoCronometro {
  if (estado.desde !== null) return estado
  return { ...estado, desde: agora }
}

export interface FaseDoPomodoro {
  fase: 'foco' | 'pausa'
  /** Quanto falta para a fase acabar, em ms. */
  restante: number
  /** Ciclo atual, a partir de 1. */
  ciclo: number
}

export function faseDoPomodoro(ms: number): FaseDoPomodoro {
  const ciclo = Math.floor(ms / CICLO_MS) + 1
  const dentro = ms % CICLO_MS
  return dentro < FOCO_MS
    ? { fase: 'foco', restante: FOCO_MS - dentro, ciclo }
    : { fase: 'pausa', restante: CICLO_MS - dentro, ciclo }
}

/**
 * Quanto tempo de estudo de fato.
 *
 * No Pomodoro, a pausa de cinco minutos não é estudo: somá-la inflaria a conta
 * em um sexto, e a semana de "10 horas" teria sido de oito e pouco.
 */
export function tempoDeEstudo(estado: EstadoDoCronometro, agora: number): number {
  const ms = decorrido(estado, agora)
  if (!estado.pomodoro) return ms
  const ciclosInteiros = Math.floor(ms / CICLO_MS)
  return ciclosInteiros * FOCO_MS + Math.min(ms % CICLO_MS, FOCO_MS)
}

export function minutosParaGravar(estado: EstadoDoCronometro, agora: number): number {
  return Math.round(tempoDeEstudo(estado, agora) / 60_000)
}

/** "07:42" até uma hora; "1:07:42" depois. */
export function formatarCronometro(ms: number): string {
  const total = Math.floor(Math.max(ms, 0) / 1000)
  const horas = Math.floor(total / 3600)
  const minutos = Math.floor((total % 3600) / 60)
  const segundos = total % 60
  const mmss = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`
  return horas > 0 ? `${horas}:${mmss}` : mmss
}

/**
 * Lê o estado guardado, tolerando lixo.
 *
 * Valor quebrado volta como "nenhum cronômetro": perder um cronômetro correndo
 * é ruim, mas travar a casca do app inteira por causa dele é pior.
 */
export function interpretarCronometro(cru: string | null): EstadoDoCronometro | null {
  if (!cru) return null
  try {
    const dado = JSON.parse(cru) as Partial<EstadoDoCronometro> | null
    if (!dado || typeof dado !== 'object') return null
    if (typeof dado.rotulo !== 'string' || typeof dado.dia !== 'string') return null
    if (typeof dado.acumulado !== 'number' || !Number.isFinite(dado.acumulado)) return null
    if (dado.desde !== null && typeof dado.desde !== 'number') return null
    return {
      program_id: typeof dado.program_id === 'string' ? dado.program_id : null,
      subject_id: typeof dado.subject_id === 'string' ? dado.subject_id : null,
      rotulo: dado.rotulo,
      desde: dado.desde ?? null,
      acumulado: dado.acumulado,
      dia: dado.dia,
      pomodoro: dado.pomodoro === true,
    }
  } catch {
    return null
  }
}
