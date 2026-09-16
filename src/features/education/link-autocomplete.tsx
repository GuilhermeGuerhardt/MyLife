import { FileText, Plus } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react'
import { chaveTitulo, linkEmAberto } from '@/lib/education/links'
import { cn } from '@/lib/utils'

/** Nunca mais que isto na lista: rolagem dentro de sugestão ninguém percorre. */
const MAX = 6

export interface Sugestao {
  id: string
  title: string
}

/**
 * O autocompletar de `[[`.
 *
 * Sem ele a funcionalidade morre na segunda semana: ligar por título exige
 * lembrar o título exato, e ninguém lembra.
 *
 * O campo vem sempre do evento, nunca de um `ref` — é o elemento que disparou
 * a tecla, então existe por definição, e a posição do cursor lida dele é a real
 * naquele instante. Guardar o cursor em estado o deixaria um passo atrás.
 */
export function useLinkAutocomplete({
  value,
  onChange,
  notas,
}: {
  value: string
  onChange: (texto: string, cursor: number) => void
  notas: Sugestao[]
}) {
  const [aberto, setAberto] = useState<{ termo: string; inicio: number } | null>(null)
  const [indice, setIndice] = useState(0)
  // O último campo visto, para o clique do mouse na sugestão — ali não há
  // evento de teclado de onde tirá-lo.
  const campoRef = useRef<HTMLTextAreaElement | null>(null)

  const opcoes = aberto ? filtrar(notas, aberto.termo) : []
  // Termo digitado que não casa com nada vira "criar": escrever o nome do
  // conceito e preencher depois é o hábito que faz o caderno crescer.
  const criar = aberto !== null && aberto.termo.trim().length > 0 && !temExato(opcoes, aberto.termo)
  const total = opcoes.length + (criar ? 1 : 0)

  useEffect(() => setIndice(0), [aberto?.termo])

  /** Relê a posição do cursor a cada digitação, clique ou movimento. */
  const sincronizar = (evento: SyntheticEvent<HTMLTextAreaElement>) => {
    const campo = evento.currentTarget
    campoRef.current = campo
    setAberto(linkEmAberto(campo.value, campo.selectionStart))
  }

  const fechar = () => setAberto(null)

  const escolher = (titulo: string) => {
    if (!aberto) return

    // O cursor está logo depois do que foi digitado dentro do `[[`, então dá
    // para calculá-lo sem perguntar ao campo.
    const fim = aberto.inicio + 2 + aberto.termo.length
    const texto = `${value.slice(0, aberto.inicio)}[[${titulo}]]${value.slice(fim)}`
    const cursor = aberto.inicio + titulo.length + 4

    setAberto(null)
    onChange(texto, cursor)

    const campo = campoRef.current
    if (!campo) return
    // Depois do render, ou o cursor voltaria para o fim do texto.
    requestAnimationFrame(() => {
      campo.focus()
      campo.setSelectionRange(cursor, cursor)
    })
  }

  /**
   * Devolve `true` quando consumiu a tecla — o campo não deve reagir a ela.
   * Enter com a lista aberta escolhe, não quebra linha.
   */
  const teclou = (evento: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    campoRef.current = evento.currentTarget
    if (!aberto) return false

    if (evento.key === 'Escape') {
      fechar()
      return true
    }
    if (total === 0) return false

    if (evento.key === 'ArrowDown') {
      setIndice((i) => (i + 1) % total)
      return true
    }
    if (evento.key === 'ArrowUp') {
      setIndice((i) => (i - 1 + total) % total)
      return true
    }
    if (evento.key === 'Enter' || evento.key === 'Tab') {
      const opcao = opcoes[indice]
      escolher(opcao ? opcao.title : aberto.termo.trim())
      return true
    }
    return false
  }

  return {
    aberto: aberto !== null,
    opcoes,
    criar,
    indice,
    termo: aberto?.termo ?? '',
    sincronizar,
    fechar,
    escolher,
    teclou,
  }
}

function filtrar(notas: Sugestao[], termo: string): Sugestao[] {
  const chave = chaveTitulo(termo)
  if (!chave) return notas.slice(0, MAX)
  return notas.filter((nota) => chaveTitulo(nota.title).includes(chave)).slice(0, MAX)
}

function temExato(opcoes: Sugestao[], termo: string): boolean {
  const chave = chaveTitulo(termo)
  return opcoes.some((opcao) => chaveTitulo(opcao.title) === chave)
}

export function LinkSuggestions({
  opcoes,
  criar,
  termo,
  indice,
  onEscolher,
}: {
  opcoes: Sugestao[]
  criar: boolean
  termo: string
  indice: number
  onEscolher: (titulo: string) => void
}) {
  if (opcoes.length === 0 && !criar) return null

  return (
    <div className="border-border-base bg-surface absolute right-4 bottom-3 left-4 z-10 overflow-hidden rounded-lg border shadow-lg">
      <p className="text-fg-subtle border-border-base border-b px-3 py-1.5 text-[10px]">
        ligar a uma anotação · ↑↓ para escolher, Enter confirma
      </p>
      {opcoes.map((opcao, i) => (
        <button
          key={opcao.id}
          type="button"
          // `mousedown` e não `click`: o clique tiraria o foco do campo antes,
          // e o `onBlur` fecharia a lista debaixo do dedo.
          onMouseDown={(e) => {
            e.preventDefault()
            onEscolher(opcao.title)
          }}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors',
            i === indice ? 'bg-accent-soft text-accent' : 'text-fg hover:bg-surface-2',
          )}
        >
          <FileText className="size-3.5 shrink-0 opacity-60" />
          <span className="truncate">{opcao.title || 'Sem título'}</span>
        </button>
      ))}
      {criar && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            onEscolher(termo.trim())
          }}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors',
            indice >= opcoes.length ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:bg-surface-2',
          )}
        >
          <Plus className="size-3.5 shrink-0" />
          <span className="truncate">Ligar a "{termo.trim()}" — ainda não existe</span>
        </button>
      )}
    </div>
  )
}
