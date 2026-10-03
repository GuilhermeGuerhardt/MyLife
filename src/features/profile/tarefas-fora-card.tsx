import { RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useHiddenTasks, useNotes, useTasks } from '@/data/queries'
import { tarefasDe } from '@/lib/education/tarefas-da-nota'
import { apenasAsOcultas, montarLista } from '@/lib/routine/tarefas'

/** Acima disso a lista vira parede, que foi o motivo de ela sair do quadro. */
const VISIVEIS = 8

/**
 * As tarefas do caderno que saíram do quadro, e o caminho de volta.
 *
 * Mora aqui, e não no A fazer, porque lá ela crescia junto com o uso: quem
 * limpa uma anotação de cinquenta caixinhas ficava com uma lista de cinquenta
 * linhas embaixo do quadro, avisando de algo que a pessoa já sabia. O quadro
 * mostra o que se tem para fazer; o que foi tirado dele é assunto de
 * configuração.
 *
 * O cartão inteiro some quando não há nada fora do quadro, que é o caso normal.
 */
export function TarefasForaCard() {
  const { data: tasks } = useTasks()
  const { data: notes } = useNotes()
  const { data: ocultas, remove } = useHiddenTasks()
  const [vendoTudo, setVendoTudo] = useState(false)

  const fora = useMemo(
    () =>
      apenasAsOcultas(
        montarLista(
          tasks,
          notes.map((nota) => ({ id: nota.id, title: nota.title, tarefas: tarefasDe(nota) })),
        ),
        ocultas,
      ),
    [tasks, notes, ocultas],
  )

  if (fora.length === 0) return null

  const lista = vendoTudo ? fora : fora.slice(0, VISIVEIS)

  /**
   * Devolve pela anotação e pelo texto, que é como a linha foi gravada.
   *
   * Uma tarefa tirada do quadro duas vezes deixa duas linhas iguais; apagar
   * todas as que casam evita que ela volte hoje e suma de novo amanhã.
   */
  const devolver = (nota: string, texto: string) => {
    for (const linha of ocultas.filter((o) => o.nota === nota && o.texto === texto)) {
      remove.mutate(linha.id)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Tarefas fora do quadro"
        description="Caixinhas que você tirou do A fazer. Elas continuam escritas nas anotações."
        action={
          <Button
            variant="ghost"
            onClick={() => {
              for (const linha of ocultas) remove.mutate(linha.id)
            }}
          >
            Devolver todas
          </Button>
        }
      />
      <CardContent>
        <ul className="divide-border-base divide-y">
          {lista.map((item) => (
            <li key={item.chave} className="flex items-center gap-3 py-2">
              <span className="text-fg-muted min-w-0 flex-1 truncate text-sm">{item.titulo}</span>
              {item.origem.tipo === 'nota' && (
                <>
                  <span className="text-fg-subtle hidden shrink-0 text-xs sm:block">
                    {item.origem.titulo || 'Sem título'}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => devolver(item.origem.id, item.titulo)}
                  >
                    <RotateCcw />
                    Devolver
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>

        {fora.length > VISIVEIS && (
          <Button variant="ghost" className="mt-2" onClick={() => setVendoTudo((atual) => !atual)}>
            {vendoTudo ? 'Mostrar menos' : `Ver as outras ${fora.length - VISIVEIS}`}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
