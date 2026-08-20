import { useMemo } from 'react'
import { useWidgets } from '@/data/queries'
import type { DashboardWidget } from '@/data/types'
import { WIDGETS, type WidgetDef } from './widgets'

export interface LayoutItem {
  def: WidgetDef
  visible: boolean
  position: number
  /** Linha salva no banco, quando o usuário já personalizou este widget. */
  row: DashboardWidget | null
}

/**
 * Layout do dashboard.
 *
 * O banco guarda só o que o usuário mexeu. Widget novo que entra no catálogo
 * aparece com o padrão dele no fim da lista, em vez de sumir por não ter linha
 * salva — assim uma versão nova do app não deixa a tela de alguém desatualizada
 * e vazia.
 */
export function useDashboardLayout() {
  const { data: rows, create, update, remove } = useWidgets()

  const items = useMemo(() => {
    const byWidget = new Map(rows.map((row) => [row.widget, row]))

    const merged: LayoutItem[] = WIDGETS.map((def, index) => {
      const row = byWidget.get(def.id) ?? null
      return {
        def,
        visible: row ? row.visible : def.defaultVisible,
        // Sem linha salva, a posição é a do catálogo, deslocada para o fim.
        position: row ? row.position : WIDGETS.length + index,
        row,
      }
    })

    return merged.sort((a, b) => a.position - b.position)
  }, [rows])

  /**
   * Materializa a ordem atual no banco. Chamada antes de qualquer edição:
   * reordenar exige que todos os widgets tenham posição gravada, senão mover um
   * item mexe na posição relativa de quem nunca foi salvo.
   */
  const materialize = async (): Promise<Map<string, DashboardWidget>> => {
    const saved = new Map(rows.map((row) => [row.widget, row]))
    const missing = items.filter((item) => !item.row)
    if (missing.length === 0) return saved

    const created = await Promise.all(
      items.map(async (item, index) => {
        if (item.row) {
          if (item.row.position === index) return item.row
          return update.mutateAsync({ id: item.row.id, patch: { position: index } })
        }
        return create.mutateAsync({
          widget: item.def.id,
          position: index,
          visible: item.visible,
        })
      }),
    )

    return new Map(created.map((row) => [row.widget, row]))
  }

  const toggle = async (widgetId: string) => {
    const saved = await materialize()
    const row = saved.get(widgetId)
    if (row) await update.mutateAsync({ id: row.id, patch: { visible: !row.visible } })
  }

  /** Troca de lugar com o vizinho. Setas em vez de arrastar: funciona no teclado. */
  const move = async (widgetId: string, direction: -1 | 1) => {
    const index = items.findIndex((item) => item.def.id === widgetId)
    const target = index + direction
    if (index === -1 || target < 0 || target >= items.length) return

    const saved = await materialize()
    const current = saved.get(widgetId)
    const neighbour = saved.get(items[target]!.def.id)
    if (!current || !neighbour) return

    await Promise.all([
      update.mutateAsync({ id: current.id, patch: { position: neighbour.position } }),
      update.mutateAsync({ id: neighbour.id, patch: { position: current.position } }),
    ])
  }

  /** Volta ao padrão apagando o que foi salvo. */
  const reset = async () => {
    await Promise.all(rows.map((row) => remove.mutateAsync(row.id)))
  }

  return {
    items,
    visible: items.filter((item) => item.visible),
    isCustomized: rows.length > 0,
    toggle,
    move,
    reset,
  }
}
