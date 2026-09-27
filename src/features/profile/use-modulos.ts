import { useMemo } from 'react'
import { NAV, type NavItem } from '@/components/layout/nav'
import { useModules } from '@/data/queries'
import { escondidos, montarModulos } from '@/lib/modulos'

/**
 * Os módulos que este usuário quer ver.
 *
 * Duas telas perguntam a mesma coisa — o menu, para saber o que listar, e o
 * painel, para saber que widget ainda faz sentido —, então a regra fica num só
 * lugar. A leitura é a mesma consulta nas duas: o cache dedupe por chave.
 */
export function useModulos() {
  const { data: rows, create, update, remove } = useModules()

  const itens = useMemo(() => montarModulos(NAV, rows), [rows])
  const fora = useMemo(() => escondidos(itens), [itens])

  /** O menu, já filtrado, na ordem do catálogo. */
  const menu = useMemo<NavItem[]>(
    () => itens.filter((item) => item.visible).map((item) => item.def),
    [itens],
  )

  /**
   * Liga e desliga um módulo.
   *
   * Grava linha só quando some do menu; voltar ao padrão é a ausência de linha,
   * não uma linha dizendo `true` — assim `mostrarTodos` é um apagar limpo.
   */
  const alternar = async (rota: string) => {
    const item = itens.find((candidato) => candidato.def.to === rota)
    if (!item?.podeEsconder) return

    const row = rows.find((candidato) => candidato.modulo === rota)
    if (!row) {
      await create.mutateAsync({ modulo: rota, visible: false })
      return
    }
    if (row.visible) await update.mutateAsync({ id: row.id, patch: { visible: false } })
    else await remove.mutateAsync(row.id)
  }

  const mostrarTodos = async () => {
    await Promise.all(rows.map((row) => remove.mutateAsync(row.id)))
  }

  return {
    itens,
    menu,
    /** As rotas que saíram do menu. */
    fora,
    temEscondido: fora.size > 0,
    alternar,
    mostrarTodos,
  }
}
