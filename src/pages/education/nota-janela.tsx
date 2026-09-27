/**
 * Uma anotação sozinha, numa janela só dela.
 *
 * Fora da casca do app: sem menu lateral, sem árvore de pastas, sem cabeçalho
 * de módulo. Sobra a barra de formatação, o texto e o rodapé — que é o que se
 * quer olhando para uma tela inteira dedicada a escrever, ainda mais quando ela
 * está no segundo monitor e a janela principal mostra a aula.
 *
 * Grava no mesmo banco da janela principal, com o mesmo salvamento automático.
 * Quem avisa a outra janela de que algo mudou é `lib/sincronia`.
 */

import { NotebookPen } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/misc'
import { useNotes, usePrograms } from '@/data/queries'
import type { Note } from '@/data/types'
import { NoteEditor, type NoteMode } from '@/features/education/note-editor'
import { useNoteWindowMode } from '@/features/education/use-notebook-prefs'
import { chaveTitulo, indicePorTitulo } from '@/lib/education/links'

export function NotaJanela() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: notes, update, isLoading } = useNotes()
  const { data: programs } = usePrograms()
  const [mode, setMode] = useNoteWindowMode()

  const note = notes.find((n) => n.id === id) ?? null
  const porTitulo = useMemo(() => indicePorTitulo(notes), [notes])

  if (!note) {
    return (
      <div className="bg-bg flex h-dvh items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <EmptyState
            icon={<NotebookPen className="size-5" />}
            title={isLoading ? 'Abrindo a anotação…' : 'Anotação não encontrada'}
            description={
              isLoading
                ? 'Só um instante.'
                : 'Ela pode ter sido removida na janela principal. Pode fechar esta.'
            }
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="bg-bg h-dvh">
      <NoteEditor
        key={note.id}
        note={note}
        variante="janela"
        mode={mode}
        onModeChange={setMode}
        programs={programs}
        subjects={[]}
        onBack={() => undefined}
        onSave={(patch) => update.mutate({ id: note.id, patch })}
        onRemove={() => undefined}
        backlinks={[]}
        onAbrirNota={() => undefined}
        /* Um `[[link]]` clicado aqui troca a anotação desta janela, sem mexer
           na principal. Para o que ainda não existe não há o que abrir: criar
           anotação é decisão que se toma com a lista à vista. */
        onAbrirPorTitulo={(titulo) => {
          // Pelo roteador, não pelo endereço: trocar a URL de verdade faria o
          // app instalado procurar um arquivo `/janela/nota/...` que não
          // existe, e a janela abriria em branco.
          const alvo = porTitulo.get(chaveTitulo(titulo))
          if (alvo) navigate(`/janela/nota/${alvo.id}`)
        }}
        existeNota={(titulo) => porTitulo.has(chaveTitulo(titulo))}
        titulosDisponiveis={titulosDisponiveis(notes, note)}
        nomeDoCurso={() => null}
      />
    </div>
  )
}

function titulosDisponiveis(notes: Note[], atual: Note) {
  return notes.filter((n) => n.id !== atual.id).map((n) => ({ id: n.id, title: n.title }))
}

export type { NoteMode }
