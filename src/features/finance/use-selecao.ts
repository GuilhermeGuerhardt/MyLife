import { useEffect, useState } from 'react'
import type { Transaction } from '@/data/types'
import type { Competence } from '@/lib/finance/billing'
import { podarSelecao } from '@/lib/finance/selecao'

const NENHUM: ReadonlySet<string> = new Set()

export interface Selecao {
  /** Ids marcados — sempre um subconjunto da lista visível. */
  selecionados: ReadonlySet<string>
  /** Os lançamentos marcados, na ordem da lista. É sobre eles que a ação age. */
  itens: Transaction[]
  /** Quantos a lista mostra agora, marcados ou não. */
  visiveis: number
  alternar: (id: string) => void
  /** `true` marca tudo o que está visível; `false` desmarca tudo. */
  alternarTodos: (marcar: boolean) => void
  /**
   * Tira só estes. É o que a ação usa ao terminar: enquanto ela gravava a
   * pessoa pode ter marcado outra linha, e limpar tudo levaria essa junto.
   */
  desmarcar: (ids: Iterable<string>) => void
  limpar: () => void
}

/**
 * Quais lançamentos da lista estão marcados.
 *
 * A seleção vale só para o que está na tela. Ela é podada a cada mudança da
 * lista visível — filtro, busca, mês, um lançamento que sumiu — e a poda roda
 * no próprio render, não num efeito: com efeito havia um quadro em que a barra
 * ainda contava, e a ação ainda alcançava, o que o filtro já tinha escondido.
 */
export function useSelecao(visiveis: Transaction[], competence: Competence): Selecao {
  const [selecionados, setSelecionados] = useState<ReadonlySet<string>>(NENHUM)
  const [mesAntes, setMesAntes] = useState(competence)

  // Trocar de mês recomeça do zero, mesmo que algum id se repetisse: o que se
  // marcou em setembro não é escolha feita em outubro.
  if (competence !== mesAntes) {
    setMesAntes(competence)
    setSelecionados(NENHUM)
  } else {
    // `podarSelecao` devolve o mesmo conjunto quando nada sai, e é isso que
    // faz este ajuste parar no segundo render em vez de girar sem fim.
    const podado = podarSelecao(selecionados, visiveis)
    if (podado !== selecionados) setSelecionados(podado)
  }

  const algum = selecionados.size > 0

  useEffect(() => {
    if (!algum) return
    function aoTeclar(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      // Com modal aberto, o Esc é dele. A escuta é na janela, em captura, para
      // rodar antes da do modal: depois dela o modal já pode ter fechado, e o
      // mesmo Esc fecharia o editor e ainda desmarcaria tudo.
      if (document.querySelector('[aria-modal="true"]')) return
      setSelecionados(NENHUM)
    }
    window.addEventListener('keydown', aoTeclar, true)
    return () => window.removeEventListener('keydown', aoTeclar, true)
  }, [algum])

  return {
    selecionados,
    itens: algum ? visiveis.filter((t) => selecionados.has(t.id)) : [],
    visiveis: visiveis.length,
    alternar(id) {
      setSelecionados((atual) => {
        const proximo = new Set(atual)
        if (proximo.has(id)) proximo.delete(id)
        else proximo.add(id)
        return proximo
      })
    },
    alternarTodos(marcar) {
      setSelecionados(marcar ? new Set(visiveis.map((t) => t.id)) : NENHUM)
    },
    desmarcar(ids) {
      setSelecionados((atual) => {
        const proximo = new Set(atual)
        for (const id of ids) proximo.delete(id)
        return proximo.size === 0 ? NENHUM : proximo
      })
    },
    limpar() {
      setSelecionados(NENHUM)
    },
  }
}
