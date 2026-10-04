import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { Progress, Stat } from '@/components/ui/misc'
import { Modal } from '@/components/ui/modal'
import { useStudySessions } from '@/data/queries'
import { porDisciplina, resumoDoEstudo } from '@/lib/education/tempo-de-estudo'
import { duration, shortDate } from '@/lib/format'
import { today } from '@/lib/utils'

/**
 * Quanto se estudou neste curso: a semana, as anteriores e cada disciplina.
 *
 * O lançamento à mão existe porque o cronômetro esquecido é a regra, não a
 * exceção: quem estudou duas horas na biblioteca sem ligar nada não pode ficar
 * com a semana zerada.
 */
export function TempoDeEstudo({
  programId,
  disciplinas = [],
}: {
  programId: string
  /** As disciplinas do curso, para nomear e escolher. Vazio em curso livre. */
  disciplinas?: Array<{ id: string; name: string }>
}) {
  const { data: todas, create, remove } = useStudySessions()
  const [lancando, setLancando] = useState(false)

  const sessoes = todas.filter((sessao) => sessao.program_id === programId)
  const resumo = resumoDoEstudo(sessoes, today())
  const nomeDe = (id: string | null) =>
    disciplinas.find((disciplina) => disciplina.id === id)?.name ?? 'Curso em geral'
  const porMateria = disciplinas.length > 0 ? porDisciplina(sessoes).slice(0, 6) : []
  const recentes = [...sessoes]
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
    .slice(0, 5)

  return (
    <Card>
      <CardHeader
        title="Tempo de estudo"
        description="O cronômetro grava sozinho ao encerrar. Estudou sem ligar? Lance à mão."
        action={
          <Button variant="ghost" size="sm" onClick={() => setLancando(true)}>
            <Plus />
            Lançar à mão
          </Button>
        }
      />
      <CardContent className="space-y-5">
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Esta semana" value={duration(resumo.semana)} />
          <Stat label="Semana passada" value={duration(resumo.semanaPassada)} />
          <Stat label="Últimas 4 semanas" value={duration(resumo.quatroSemanas)} />
        </div>

        {sessoes.length === 0 ? (
          <p className="text-fg-muted text-sm">
            Nenhum estudo registrado ainda. O botão Estudar liga o cronômetro, que fica no topo
            da tela enquanto corre.
          </p>
        ) : (
          <>
            {porMateria.length > 0 && (
              <div className="space-y-2">
                <p className="text-fg-muted text-xs font-medium">Por disciplina, desde o começo</p>
                {porMateria.map((item) => (
                  <div key={item.subjectId ?? 'geral'} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="text-fg truncate">{nomeDe(item.subjectId)}</span>
                      <span className="text-fg-muted tabular-nums">{duration(item.minutos)}</span>
                    </div>
                    <Progress value={item.minutos} max={porMateria[0]!.minutos} />
                  </div>
                ))}
              </div>
            )}

            <div>
              <p className="text-fg-muted mb-1 text-xs font-medium">Últimos registros</p>
              <ul className="divide-border-base divide-y">
                {recentes.map((sessao) => (
                  <li key={sessao.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="text-fg-subtle w-12 shrink-0 text-xs">
                      {shortDate(sessao.date)}
                    </span>
                    <span className="text-fg min-w-0 flex-1 truncate">
                      {disciplinas.length > 0 ? nomeDe(sessao.subject_id) : 'Estudo'}
                    </span>
                    <span className="text-fg-muted tabular-nums">{duration(sessao.minutes)}</span>
                    <button
                      type="button"
                      onClick={() => remove.mutate(sessao.id)}
                      className="text-fg-subtle hover:text-negative transition-colors"
                      aria-label={`Apagar o estudo de ${shortDate(sessao.date)}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>

      {lancando && (
        <LancarEstudo
          disciplinas={disciplinas}
          onClose={() => setLancando(false)}
          onSave={async (valores) => {
            await create.mutateAsync({
              ...valores,
              program_id: programId,
              notes: null,
              deleted_at: null,
            })
            setLancando(false)
          }}
        />
      )}
    </Card>
  )
}

function LancarEstudo({
  disciplinas,
  onClose,
  onSave,
}: {
  disciplinas: Array<{ id: string; name: string }>
  onClose: () => void
  onSave: (valores: { date: string; minutes: number; subject_id: string | null }) => Promise<void>
}) {
  const [data, setData] = useState(today())
  const [minutos, setMinutos] = useState('')
  const [disciplina, setDisciplina] = useState('')
  const valor = Math.round(Number(minutos.replace(',', '.')))
  const valido = Number.isFinite(valor) && valor >= 1 && valor <= 24 * 60 && data !== ''

  return (
    <Modal
      open
      onClose={onClose}
      title="Lançar estudo"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!valido}
            onClick={() =>
              void onSave({ date: data, minutes: valor, subject_id: disciplina || null })
            }
          >
            Lançar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dia">
          <Input type="date" value={data} max={today()} onChange={(e) => setData(e.target.value)} />
        </Field>
        <Field label="Quanto tempo" suffix="min">
          <Input
            inputMode="numeric"
            value={minutos}
            onChange={(e) => setMinutos(e.target.value)}
            placeholder="90"
            autoFocus
          />
        </Field>
        {disciplinas.length > 0 && (
          <Field label="Disciplina" className="sm:col-span-2">
            <Select value={disciplina} onChange={(e) => setDisciplina(e.target.value)}>
              <option value="">Curso em geral</option>
              {disciplinas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
    </Modal>
  )
}
