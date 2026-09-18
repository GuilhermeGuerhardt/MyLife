import { Bookmark, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import type { Food, MealPreset, MealSlot } from '@/data/types'
import { integer } from '@/lib/format'
import { resumoDaRefeicao } from '@/lib/health/nutrition'

/**
 * A faixa de refeições salvas, no topo da busca de alimento.
 *
 * Fica aqui em vez de virar botão próprio no cartão: quem vai registrar já
 * clicou em "Adicionar", e o prato de sempre é a resposta mais provável para
 * "o que você comeu". Aparecer antes da busca é reconhecer isso.
 */
export function MealPresetStrip({
  presets,
  foods,
  slot,
  onUse,
  onRemove,
}: {
  presets: MealPreset[]
  foods: Food[]
  /** Refeição do horário atual vem primeiro — mas nenhuma é escondida. */
  slot: MealSlot
  onUse: (preset: MealPreset) => void
  onRemove: (preset: MealPreset) => void
}) {
  if (presets.length === 0) return null

  // Ordena sem filtrar: café da manhã à noite é uma escolha, não um erro.
  const ordenadas = [...presets].sort(
    (a, b) => Number(b.slot === slot) - Number(a.slot === slot) || a.name.localeCompare(b.name),
  )

  return (
    <div className="border-border-base -mx-1 border-b pb-3">
      <p className="text-fg-subtle mb-2 flex items-center gap-1.5 px-1 text-[11px]">
        <Bookmark className="size-3.5" />
        Suas refeições
      </p>

      <div className="flex flex-wrap gap-2 px-1">
        {ordenadas.map((preset) => {
          const { itens, totais } = resumoDaRefeicao(preset.items, foods)
          return (
            <div
              key={preset.id}
              className="border-border-base bg-surface-2 hover:border-accent group relative rounded-lg border transition-colors"
            >
              <button
                type="button"
                onClick={() => onUse(preset)}
                className="px-3 py-2 pr-8 text-left"
              >
                <p className="text-fg text-[13px] font-medium">{preset.name}</p>
                <p className="text-fg-subtle text-[11px]">
                  {itens} {itens === 1 ? 'item' : 'itens'} · {integer(totais.kcal)} kcal
                </p>
              </button>
              {/*
                Sempre visível, nunca só no hover: um botão que aparece ao
                passar o mouse não existe para quem não passou — e não existe
                de jeito nenhum no toque. O tom apagado já basta para ele não
                competir com o nome da refeição.
              */}
              <button
                type="button"
                onClick={() => onRemove(preset)}
                aria-label={`Remover a refeição ${preset.name}`}
                title="Remover"
                className="text-fg-subtle hover:text-negative hover:bg-surface absolute top-1 right-1 rounded p-1 transition-colors"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * O único pedaço de tela que a funcionalidade precisou: dar nome ao prato.
 *
 * Um `prompt()` do navegador resolveria em uma linha, mas dentro da WebView2
 * ele aparece como caixa do webview, com o endereço interno no título — é o que
 * faz um programa instalado parecer uma página aberta. A mesma razão pela qual
 * `lib/avisos.ts` existe.
 */
export function SaveMealDialog({
  sugestao,
  onSave,
  onClose,
}: {
  /** O nome da refeição do horário — "Almoço" já é um bom padrão. */
  sugestao: string
  onSave: (nome: string) => Promise<void>
  onClose: () => void
}) {
  const [nome, setNome] = useState(sugestao)
  const [salvando, setSalvando] = useState(false)

  const confirmar = async () => {
    const limpo = nome.trim()
    if (!limpo || salvando) return
    setSalvando(true)
    await onSave(limpo)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Salvar refeição"
      description="Os alimentos deste prato ficam guardados com a quantidade. Da próxima vez, um clique registra tudo."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void confirmar()} disabled={!nome.trim() || salvando}>
            Salvar
          </Button>
        </>
      }
    >
      <Field label="Nome" hint="Como você chama esse prato">
        <Input
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void confirmar()
          }}
          placeholder="Almoço de sempre"
        />
      </Field>
    </Modal>
  )
}
