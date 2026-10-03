import { ChevronRight, ChevronsDownUp, ChevronsUpDown, ListPlus, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, EmptyState, Progress } from '@/components/ui/misc'
import type { CourseLesson } from '@/data/types'
import { duration, percent } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * As aulas do curso, agrupadas em módulos que recolhem.
 *
 * O cabeçalho inteiro é o gatilho de recolher: em curso com trinta módulos,
 * mirar numa setinha de 14 px é trabalho desnecessário.
 */
export function ListaDeAulas({
  lessons,
  onAdicionar,
  onMarcar,
  onRemover,
  programId,
}: {
  lessons: CourseLesson[]
  onAdicionar: () => void
  onMarcar: (id: string, feita: boolean) => void
  onRemover: (id: string) => void
  /** A memória de quais módulos estão recolhidos é por curso. */
  programId: string | undefined
}) {
  const { recolhidos, alternar, recolherTudo, expandirTudo } = useModulosRecolhidos(programId)

  const modulos = agruparPorModulo(lessons)
  const tudoRecolhido = modulos.length > 0 && modulos.every(([nome]) => recolhidos.has(nome))

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-fg text-base font-semibold">Aulas</h2>
        <div className="flex gap-2">
          {modulos.length > 1 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                tudoRecolhido ? expandirTudo() : recolherTudo(modulos.map(([nome]) => nome))
              }
            >
              {tudoRecolhido ? <ChevronsUpDown /> : <ChevronsDownUp />}
              {tudoRecolhido ? 'Expandir tudo' : 'Recolher tudo'}
            </Button>
          )}
          <Button size="sm" onClick={onAdicionar}>
            <ListPlus />
            Adicionar aulas
          </Button>
        </div>
      </div>

      {lessons.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma aula cadastrada"
            description="Cole a lista de aulas do curso de uma vez, uma por linha, e o progresso passa a ser calculado sozinho."
            action={
              <Button size="sm" onClick={onAdicionar}>
                Adicionar aulas
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {modulos.map(([nome, items]) => {
            const feitas = items.filter((l) => l.done).length
            const aberto = !recolhidos.has(nome)
            const minutos = items.filter((l) => !l.done).reduce((s, l) => s + l.duration_min, 0)

            return (
              <Card key={nome}>
                <button
                  type="button"
                  onClick={() => alternar(nome)}
                  aria-expanded={aberto}
                  className="hover:bg-surface-2 flex w-full items-center gap-3 rounded-[var(--radius-card)] px-5 py-4 text-left transition-colors"
                >
                  <ChevronRight
                    className={cn(
                      'text-fg-subtle size-4 shrink-0 transition-transform',
                      aberto && 'rotate-90',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-fg block truncate text-sm font-semibold">
                      {nome || 'Sem módulo'}
                    </span>
                    <span className="text-fg-muted mt-0.5 block text-xs">
                      {feitas} de {items.length} aulas
                      {minutos > 0 && ` · faltam ${duration(minutos)}`}
                    </span>
                  </span>
                  <Progress
                    value={(feitas / items.length) * 100}
                    tone={feitas === items.length ? 'positive' : 'accent'}
                    className="hidden w-24 shrink-0 sm:block"
                  />
                  <Badge tone={feitas === items.length ? 'positive' : 'neutral'}>
                    {percent((feitas / items.length) * 100, 0)}
                  </Badge>
                </button>

                {aberto && (
                  <CardContent className="border-border-base border-t pt-3">
                    <div className="divide-border-base divide-y">
                      {items.map((lesson) => (
                        <div key={lesson.id} className="flex items-center gap-3 py-2">
                          <input
                            type="checkbox"
                            checked={lesson.done}
                            onChange={(e) => onMarcar(lesson.id, e.target.checked)}
                            className="accent-accent size-4 shrink-0 cursor-pointer"
                            aria-label={`Concluir ${lesson.title}`}
                          />
                          <span
                            className={
                              lesson.done
                                ? 'text-fg-subtle flex-1 truncate text-sm line-through'
                                : 'text-fg flex-1 truncate text-sm'
                            }
                          >
                            {lesson.title}
                          </span>
                          {lesson.duration_min > 0 && (
                            <span className="text-fg-subtle text-xs">
                              {duration(lesson.duration_min)}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => onRemover(lesson.id)}
                            className="text-fg-subtle hover:text-negative transition-colors"
                            aria-label={`Remover ${lesson.title}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}

function agruparPorModulo(lessons: CourseLesson[]): Array<[string, CourseLesson[]]> {
  const map = new Map<string, CourseLesson[]>()
  for (const lesson of lessons) {
    const list = map.get(lesson.module) ?? []
    list.push(lesson)
    map.set(lesson.module, list)
  }
  return [...map.entries()]
}

/**
 * Módulos recolhidos deste curso.
 *
 * A escolha fica no navegador, por curso: num curso de quarenta módulos, ter de
 * recolher tudo de novo a cada visita anularia o ganho de poder recolher.
 */
function useModulosRecolhidos(programId: string | undefined) {
  const chave = `life:curso:${programId}:modulos-recolhidos`

  const [recolhidos, setRecolhidos] = useState<Set<string>>(() => {
    try {
      const guardado = localStorage.getItem(chave)
      return new Set<string>(guardado ? (JSON.parse(guardado) as string[]) : [])
    } catch {
      return new Set<string>()
    }
  })

  const gravar = useCallback(
    (proximo: Set<string>) => {
      setRecolhidos(proximo)
      try {
        localStorage.setItem(chave, JSON.stringify([...proximo]))
      } catch {
        // Sem armazenamento a escolha vale só nesta sessão.
      }
    },
    [chave],
  )

  const alternar = useCallback(
    (nome: string) => {
      const proximo = new Set<string>(recolhidos)
      if (proximo.has(nome)) proximo.delete(nome)
      else proximo.add(nome)
      gravar(proximo)
    },
    [recolhidos, gravar],
  )

  return {
    recolhidos,
    alternar,
    recolherTudo: (nomes: string[]) => gravar(new Set<string>(nomes)),
    expandirTudo: () => gravar(new Set<string>()),
  }
}
