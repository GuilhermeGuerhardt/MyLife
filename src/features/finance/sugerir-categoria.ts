import { useCallback, useMemo } from 'react'
import { useCategories, useTransactions } from '@/data/queries'
import { guessCategory } from '@/data/seed-finance'
import type { Category } from '@/data/types'
import { treinar, type TipoClassificavel } from '@/lib/finance/classificador'

/**
 * O palpite de categoria, do seu histórico primeiro e do catálogo depois.
 *
 * O classificador já existia, mas só a importação o usava — quem digitava um
 * lançamento à mão continuava preso às palavras do catálogo, que não conhecem
 * a padaria da esquina nem o nome do seu salão. Aqui ele passa a valer também
 * no formulário e no registro rápido, que é onde a pessoa escreve do seu jeito.
 *
 * A ordem importa: o que você já classificou vence o catálogo, porque o
 * catálogo é um chute de fábrica e o histórico é a sua resposta. Na dúvida o
 * classificador se cala, e aí o catálogo ainda tenta.
 */
export function useSugestaoDeCategoria(): (
  descricao: string,
  kind: TipoClassificavel,
) => Category | null {
  const { data: transactions } = useTransactions()
  const { data: categories } = useCategories()

  const classificador = useMemo(() => treinar(transactions), [transactions])

  return useCallback(
    (descricao, kind) => {
      const aprendida = classificador.sugerir(descricao, kind)
      if (aprendida) {
        const categoria = categories.find((item) => item.id === aprendida.categoryId)
        // Categoria apagada, ou que mudou de tipo depois: o histórico
        // envelheceu, e insistir nela jogaria o lançamento num lugar que não
        // existe mais.
        if (categoria && categoria.kind === kind) return categoria
      }

      return guessCategory(descricao, categories, kind)
    },
    [classificador, categories],
  )
}
