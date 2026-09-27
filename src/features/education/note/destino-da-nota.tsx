import { Field, Input, Select } from '@/components/ui/field'
import type { Program, Track } from '@/data/types'

/**
 * Onde a anotação mora e como ela é etiquetada.
 *
 * Decisão que se toma ao lado da lista, não no meio de escrever — por isso esta
 * faixa some quando a anotação é aberta na janela solta, onde o que importa é
 * só o texto.
 */

/**
 * Os dois destinos que não são curso.
 *
 * O prefixo esquisito é de propósito: o valor do select ou é um id de curso ou
 * é um destes, e um id nunca começa com underscore.
 */
export const SEM_CURSO: Array<{ valor: string; track: Track; rotulo: string }> = [
  { valor: '__estudos__', track: 'free', rotulo: 'Estudo livre' },
  { valor: '__anotacoes__', track: 'personal', rotulo: 'Anotações' },
]

export function DestinoDaNota({
  onde,
  onTrocarOnde,
  academicos,
  cursos,
  disciplinas,
  comDisciplina,
  disciplina,
  onDisciplina,
  etiquetas,
  onEtiquetas,
}: {
  onde: string
  onTrocarOnde: (valor: string) => void
  academicos: Program[]
  cursos: Program[]
  /** Só o que o seletor usa: a tela passa a lista já reduzida. */
  disciplinas: Array<{ id: string; name: string }>
  /** Disciplina só existe na faculdade; no curso livre o campo nem aparece. */
  comDisciplina: boolean
  disciplina: string
  onDisciplina: (id: string) => void
  etiquetas: string
  onEtiquetas: (texto: string) => void
}) {
  return (
    <div className="border-border-base grid shrink-0 gap-3 border-b px-4 py-3 sm:grid-cols-3">
      <Field label="Onde">
        <Select value={onde} onChange={(e) => onTrocarOnde(e.target.value)}>
          {SEM_CURSO.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
          {/* A anotação antiga sem curso guarda o trilho dela: some da lista se
              for editada, mas até lá continua onde estava. */}
          {onde === '' && <option value="">Sem curso</option>}
          {academicos.length > 0 && (
            <optgroup label="Faculdade">
              {academicos.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </optgroup>
          )}
          {cursos.length > 0 && (
            <optgroup label="Cursos">
              {cursos.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </optgroup>
          )}
        </Select>
      </Field>

      {comDisciplina ? (
        <Field label="Disciplina">
          <Select value={disciplina} onChange={(e) => onDisciplina(e.target.value)}>
            <option value="">Nenhuma</option>
            {disciplinas.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <div className="hidden sm:block" />
      )}

      <Field label="Etiquetas" hint="Separadas por vírgula">
        <Input
          value={etiquetas}
          onChange={(e) => onEtiquetas(e.target.value)}
          placeholder="prova, revisão"
        />
      </Field>
    </div>
  )
}
