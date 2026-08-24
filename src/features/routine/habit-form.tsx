import { Archive, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { Segmented } from '@/components/ui/misc'
import { LIFE_AREA_LABELS, type Habit, type LifeArea } from '@/data/types'
import type { HabitCadence } from '@/lib/habits/habits'

const SUGGESTED_ICONS = ['🏃', '💪', '📚', '💧', '😴', '🧘', '🥗', '💸', '📝', '🌅', '🚭', '🎯']

export interface HabitDraft {
  name: string
  icon: string
  area: LifeArea
  cadence: HabitCadence
  target_per_week: number
  notes: string | null
  archived: boolean
  position: number
}

export function HabitForm({
  open,
  habit,
  position,
  onClose,
  onSave,
  onArchive,
  onDelete,
}: {
  open: boolean
  /** Nulo = criando. */
  habit: Habit | null
  position: number
  onClose: () => void
  onSave: (draft: HabitDraft) => void
  /** Tira da conta do dia e guarda o histórico. Reversível. */
  onArchive?: () => void
  /** Apaga o hábito e o histórico. Não tem desfazer. */
  onDelete?: () => void
}) {
  const [name, setName] = useState(habit?.name ?? '')
  const [icon, setIcon] = useState(habit?.icon ?? '🎯')
  const [area, setArea] = useState<LifeArea>(habit?.area ?? 'health')
  const [cadence, setCadence] = useState<HabitCadence>(habit?.cadence ?? 'daily')
  const [target, setTarget] = useState(habit?.target_per_week ?? 4)
  const [notes, setNotes] = useState(habit?.notes ?? '')

  const submit = () => {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      icon,
      area,
      cadence,
      target_per_week: cadence === 'daily' ? 7 : Math.min(Math.max(target, 1), 7),
      notes: notes.trim() || null,
      archived: habit?.archived ?? false,
      position: habit?.position ?? position,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={habit ? 'Editar hábito' : 'Novo hábito'}
      description="Hábito diário cobra todo dia; hábito semanal cobra uma quantidade de dias na semana."
      footer={
        <>
          {onDelete && (
            <Button variant="ghost" className="text-negative mr-auto" onClick={onDelete}>
              <Trash2 />
              Excluir
            </Button>
          )}
          {onArchive && (
            <Button variant="ghost" onClick={onArchive}>
              <Archive />
              Arquivar
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!name.trim()}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nome">
          <Input
            value={name}
            autoFocus
            placeholder="Beber 3 L de água"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && submit()}
          />
        </Field>

        <Field label="Ícone" hint="Escolha um dos sugeridos ou digite qualquer emoji.">
          <div className="flex flex-wrap items-center gap-1.5">
            <Input
              value={icon}
              maxLength={4}
              aria-label="Ícone do hábito"
              className="w-16 text-center text-lg"
              onChange={(event) => setIcon(event.target.value)}
            />
            {SUGGESTED_ICONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={`Usar ícone ${option}`}
                onClick={() => setIcon(option)}
                className={
                  icon === option
                    ? 'border-accent bg-accent-soft size-8 rounded-lg border text-base'
                    : 'border-border-base hover:bg-surface-2 size-8 rounded-lg border text-base'
                }
              >
                {option}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Área">
            <Select value={area} onChange={(event) => setArea(event.target.value as LifeArea)}>
              {Object.entries(LIFE_AREA_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Cobrança">
            <Segmented
              className="w-full"
              value={cadence}
              onChange={setCadence}
              options={[
                { value: 'daily', label: 'Todo dia' },
                { value: 'weekly', label: 'X por semana' },
              ]}
            />
          </Field>
        </div>

        {cadence === 'weekly' && (
          <Field
            label="Meta semanal"
            hint="Quantos dias por semana. Um dia solto não quebra a sequência — a semana inteira é que conta."
            suffix="dias/sem"
          >
            <Input
              type="number"
              min={1}
              max={7}
              value={target}
              onChange={(event) => setTarget(Number(event.target.value))}
            />
          </Field>
        )}

        <Field label="Observações">
          <Textarea
            value={notes}
            placeholder="Opcional — o gatilho, o horário, o porquê."
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}
