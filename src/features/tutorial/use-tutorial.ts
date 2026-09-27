import { useEffect, useMemo, useState } from 'react'
import { tutorialDaRota, type Tutorial } from './conteudo'
import {
  aoMudarVisto,
  comPulado,
  comVisto,
  deveMostrar,
  gravarVisto,
  lerVisto,
  mesmoVisto,
  type VistoDoTutorial,
} from './visto'

export interface EstadoDoTutorial {
  /** O guia desta tela, ou nulo onde não há um. */
  tutorial: Tutorial | null
  aberto: boolean
  /** “Entendi”: fecha e não volta mais neste módulo. */
  entendi: () => void
  /** “Pular tudo”: cala o guia em todos os módulos. */
  pular: () => void
  /** O “?” do cabeçalho, para reler quando quiser. */
  reabrir: () => void
}

/**
 * O guia da tela atual: se aparece, e o que os botões dele fazem.
 *
 * Reabrir vale só para a rota em que foi pedido. Guardando apenas "está
 * reaberto", ir para outro módulo levaria o cartão junto — e o pedido era
 * reler *este*.
 */
export function useTutorial(pathname: string): EstadoDoTutorial {
  const [visto, setVisto] = useState(lerVisto)
  const [reaberto, setReaberto] = useState<string | null>(null)

  const tutorial = useMemo(() => tutorialDaRota(pathname), [pathname])

  // Quem zera os guias é outra tela; só o conteúdo diferente repinta esta.
  useEffect(
    () =>
      aoMudarVisto(() =>
        setVisto((atual) => {
          const lido = lerVisto()
          return mesmoVisto(atual, lido) ? atual : lido
        }),
      ),
    [],
  )

  function guardar(proximo: VistoDoTutorial) {
    if (proximo === visto) return
    gravarVisto(proximo)
    setVisto(proximo)
  }

  return {
    tutorial,
    aberto:
      tutorial !== null && (reaberto === tutorial.rota || deveMostrar(visto, tutorial.rota)),

    entendi: () => {
      setReaberto(null)
      if (tutorial) guardar(comVisto(visto, tutorial.rota))
    },

    pular: () => {
      setReaberto(null)
      guardar(comPulado(visto))
    },

    reabrir: () => setReaberto(tutorial?.rota ?? null),
  }
}
