/**
 * O que já foi lido, e o que foi dispensado de vez.
 *
 * Fica no aparelho, não no banco: o guia é sobre aprender a mexer no programa,
 * e quem abre o mesmo arquivo num computador novo está vendo esta tela pela
 * primeira vez ali. Levar isso no backup faria o app parecer mudo na máquina
 * nova.
 *
 * As funções devolvem o mesmo objeto quando nada muda. Um estado novo a cada
 * chamada acordaria a tela de novo, ela regravaria, e o ciclo não pararia mais —
 * já aconteceu neste app, com o aviso de importação.
 */

export interface VistoDoTutorial {
  /** Os módulos cujo cartão a pessoa fechou com “Entendi”. */
  rotas: string[]
  /** “Pular tudo”: nenhum módulo mostra o cartão sozinho outra vez. */
  pulado: boolean
}

export const NADA_VISTO: VistoDoTutorial = { rotas: [], pulado: false }

/** Se o cartão deve aparecer por conta própria nesta rota. */
export function deveMostrar(visto: VistoDoTutorial, rota: string): boolean {
  return !visto.pulado && !visto.rotas.includes(rota)
}

export function comVisto(visto: VistoDoTutorial, rota: string): VistoDoTutorial {
  if (visto.rotas.includes(rota)) return visto
  return { ...visto, rotas: [...visto.rotas, rota] }
}

export function comPulado(visto: VistoDoTutorial): VistoDoTutorial {
  return visto.pulado ? visto : { ...visto, pulado: true }
}

/** Dois estados com o mesmo conteúdo. Evita repintar a tela por objeto novo. */
export function mesmoVisto(a: VistoDoTutorial, b: VistoDoTutorial): boolean {
  return (
    a.pulado === b.pulado &&
    a.rotas.length === b.rotas.length &&
    a.rotas.every((rota, indice) => rota === b.rotas[indice])
  )
}

// ---------------------------------------------------------------------------
// Onde isso mora
// ---------------------------------------------------------------------------

const CHAVE = 'life:tutorial'
const EVENTO = 'life:tutorial-mudou'

/**
 * Lê o que está guardado, tolerando lixo.
 *
 * Valor corrompido ou de um formato antigo volta como "nada visto": mostrar um
 * guia de novo é um incômodo de um clique, e travar a tela por causa de um JSON
 * quebrado não é.
 */
export function lerVisto(): VistoDoTutorial {
  try {
    const cru = localStorage.getItem(CHAVE)
    if (!cru) return NADA_VISTO

    const dado: unknown = JSON.parse(cru)
    if (typeof dado !== 'object' || dado === null) return NADA_VISTO

    const { rotas, pulado } = dado as Partial<VistoDoTutorial>
    return {
      rotas: Array.isArray(rotas) ? rotas.filter((rota) => typeof rota === 'string') : [],
      pulado: pulado === true,
    }
  } catch {
    return NADA_VISTO
  }
}

export function gravarVisto(visto: VistoDoTutorial): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(visto))
  } catch {
    // Sem localStorage o guia vale só nesta sessão.
  }
  window.dispatchEvent(new Event(EVENTO))
}

/** Volta ao estado de quem nunca viu nada. */
export function zerarVisto(): void {
  gravarVisto(NADA_VISTO)
}

/**
 * Avisa quem está mostrando o guia que o estado mudou.
 *
 * Quem zera os guias é o Perfil, e quem desenha o cartão é a casca do app —
 * duas partes da mesma tela lendo a mesma chave. Sem o aviso, mandar "mostrar de
 * novo" só teria efeito na próxima abertura do programa.
 */
export function aoMudarVisto(escuta: () => void): () => void {
  window.addEventListener(EVENTO, escuta)
  return () => window.removeEventListener(EVENTO, escuta)
}
