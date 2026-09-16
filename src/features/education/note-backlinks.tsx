import { CornerUpLeft, FileText } from 'lucide-react'
import type { Note } from '@/data/types'
import { TRACK_LABELS } from '@/data/types'
import type { Retrolink } from '@/lib/education/links'

/**
 * "Mencionada em" — quem aponta para esta anotação.
 *
 * É o que torna a rede navegável nos dois sentidos. Sem isso, um `[[link]]` é
 * uma rua de mão única: você sai daqui para lá, mas chegando lá não descobre
 * quem trouxe você.
 */
export function NoteBacklinks({
  itens,
  onAbrir,
  nomeDoCurso,
}: {
  itens: Array<Retrolink<Note>>
  onAbrir: (id: string) => void
  /** O curso da anotação que cita, para situar de onde vem a menção. */
  nomeDoCurso: (note: Note) => string | null
}) {
  if (itens.length === 0) return null

  return (
    <div className="border-border-base bg-surface-2 border-t px-5 py-3">
      <p className="text-fg-subtle mb-2 flex items-center gap-1.5 text-[11px]">
        <CornerUpLeft className="size-3.5" />
        Mencionada em {itens.length} {itens.length === 1 ? 'anotação' : 'anotações'}
      </p>

      <div className="space-y-2">
        {itens.map(({ nota, trecho }) => {
          const curso = nomeDoCurso(nota)
          return (
            <button
              key={nota.id}
              type="button"
              onClick={() => onAbrir(nota.id)}
              className="hover:bg-surface -mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1.5 text-left transition-colors"
            >
              <span className="flex items-baseline gap-1.5">
                <FileText className="text-fg-subtle size-3.5 shrink-0 self-center" />
                <span className="text-accent truncate text-[13px]">
                  {nota.title || 'Sem título'}
                </span>
                <span className="text-fg-subtle shrink-0 text-[11px]">
                  {TRACK_LABELS[nota.track]}
                  {curso && ` · ${curso}`}
                </span>
              </span>
              <span className="text-fg-subtle mt-0.5 block truncate pl-5 text-[11px] italic">
                {trecho}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
