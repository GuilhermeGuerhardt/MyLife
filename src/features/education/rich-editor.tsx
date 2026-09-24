/**
 * O editor de texto do caderno, sem Markdown à vista.
 *
 * O Markdown continua sendo um ótimo formato para quem já o conhece, e continua
 * disponível — mas exigir que a pessoa escreva `**assim**` para ver negrito é
 * cobrar um idioma antes de deixar escrever. Aqui o texto sai formatado
 * enquanto se digita, e o que a pessoa vê é o que fica guardado.
 *
 * Guarda **HTML**, não Markdown: cor de letra e cor de sublinhado não existem
 * no Markdown, então o formato antigo não teria onde pôr o que esta tela
 * oferece. Ver `lib/education/formato.ts` para como as duas eras convivem.
 */

import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { TaskItem } from '@tiptap/extension-task-item'
import { TaskList } from '@tiptap/extension-task-list'
import { TextStyle } from '@tiptap/extension-text-style'
import { Placeholder } from '@tiptap/extensions'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { SublinhadoColorido } from './sublinhado-colorido'

/**
 * Cores fixas, não tokens do tema.
 *
 * O que a pessoa pinta fica gravado dentro do texto e precisa continuar
 * significando a mesma coisa daqui a um ano — inclusive depois de trocar de
 * tema. Por isso são tons médios, que se leem tanto no claro quanto no escuro.
 *
 * **Padrão** é a única que não é uma cor: ela tira a pintura e deixa o texto
 * seguir o tema, ficando claro no escuro e escuro no claro. É o que deve ser
 * usado em quase tudo.
 *
 * **Preto e branco são absolutos** e não acompanham nada. Existem porque foram
 * pedidos e porque às vezes se quer exatamente isso, mas texto em preto some
 * num tema escuro e em branco some num claro — ao contrário de Padrão, que
 * nunca some.
 */
const CORES_TEXTO = [
  { nome: 'Padrão (segue o tema)', valor: null },
  { nome: 'Preto', valor: '#000000' },
  { nome: 'Branco', valor: '#ffffff' },
  { nome: 'Vermelho', valor: '#e5484d' },
  { nome: 'Laranja', valor: '#f76b15' },
  { nome: 'Amarelo', valor: '#ffb224' },
  { nome: 'Verde', valor: '#30a46c' },
  { nome: 'Azul', valor: '#0091ff' },
  { nome: 'Roxo', valor: '#8e4ec6' },
  { nome: 'Rosa', valor: '#e93d82' },
] as const

const CORES_MARCA = [
  { nome: 'Sem marca', valor: null },
  { nome: 'Amarelo', valor: '#fde68a' },
  { nome: 'Verde', valor: '#bbf7d0' },
  { nome: 'Azul', valor: '#bfdbfe' },
  { nome: 'Rosa', valor: '#fbcfe8' },
  { nome: 'Roxo', valor: '#ddd6fe' },
] as const

export function RichEditor({
  content,
  onChange,
  placeholder = 'Escreva aqui. Selecione um trecho para formatar.',
  className,
}: {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // O sublinhado do StarterKit não carrega cor; o nosso carrega.
        underline: false,
        link: { openOnClick: false, autolink: true },
      }),
      SublinhadoColorido,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    // O conteúdo é do próprio usuário e nunca vem de fora; a sanitização
    // acontece na leitura, em `NoteHtml`.
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: 'prose-notes tiptap-area' },
    },
  })

  // Trocar de anotação remonta o componente pela `key`, mas uma conversão de
  // formato troca o conteúdo com o editor vivo — aí é preciso recarregar.
  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.getHTML() !== content) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
    // `content` só muda de fora em conversão; digitação não passa por aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, content])

  if (!editor) return null

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <Barra editor={editor} />
      <EditorContent editor={editor} className="min-h-0 flex-1 overflow-y-auto px-5 py-4" />
    </div>
  )
}

function Barra({ editor }: { editor: Editor }) {
  return (
    <div className="border-border-base bg-surface-2 flex flex-wrap items-center gap-0.5 border-b px-3 py-1.5">
      <Grupo>
        <Botao
          ativo={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          titulo="Negrito"
        >
          <Bold className="size-3.5" />
        </Botao>
        <Botao
          ativo={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          titulo="Itálico"
        >
          <Italic className="size-3.5" />
        </Botao>
        <Botao
          ativo={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          titulo="Sublinhado"
        >
          <UnderlineIcon className="size-3.5" />
        </Botao>
        <Botao
          ativo={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          titulo="Riscado"
        >
          <Strikethrough className="size-3.5" />
        </Botao>
        <Botao
          ativo={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
          titulo="Código"
        >
          <Code className="size-3.5" />
        </Botao>
      </Grupo>

      <Grupo>
        <Paleta
          titulo="Cor da letra"
          amostra={editor.getAttributes('textStyle').color ?? 'currentColor'}
          cores={CORES_TEXTO}
          aoEscolher={(cor) =>
            cor
              ? editor.chain().focus().setColor(cor).run()
              : editor.chain().focus().unsetColor().run()
          }
        >
          <span className="text-[13px] font-semibold">A</span>
        </Paleta>

        <Paleta
          titulo="Cor do sublinhado"
          amostra={editor.getAttributes('underline').color ?? 'currentColor'}
          cores={CORES_TEXTO}
          aoEscolher={(cor) => editor.chain().focus().setUnderlineColor(cor).run()}
        >
          <UnderlineIcon className="size-3.5" />
        </Paleta>

        <Paleta
          titulo="Marca-texto"
          amostra={editor.getAttributes('highlight').color ?? 'transparent'}
          cores={CORES_MARCA}
          aoEscolher={(cor) =>
            cor
              ? editor.chain().focus().toggleHighlight({ color: cor }).run()
              : editor.chain().focus().unsetHighlight().run()
          }
        >
          <span className="bg-warning/60 size-3.5 rounded-sm" />
        </Paleta>
      </Grupo>

      <Grupo>
        {([1, 2, 3] as const).map((nivel) => {
          const Icone = [Heading1, Heading2, Heading3][nivel - 1]!
          return (
            <Botao
              key={nivel}
              ativo={editor.isActive('heading', { level: nivel })}
              onClick={() => editor.chain().focus().toggleHeading({ level: nivel }).run()}
              titulo={`Título ${nivel}`}
            >
              <Icone className="size-3.5" />
            </Botao>
          )
        })}
      </Grupo>

      <Grupo>
        <Botao
          ativo={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          titulo="Lista"
        >
          <List className="size-3.5" />
        </Botao>
        <Botao
          ativo={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          titulo="Lista numerada"
        >
          <ListOrdered className="size-3.5" />
        </Botao>
        <Botao
          ativo={editor.isActive('taskList')}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          titulo="Lista de tarefas"
        >
          <ListTodo className="size-3.5" />
        </Botao>
        <Botao
          ativo={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          titulo="Citação"
        >
          <Quote className="size-3.5" />
        </Botao>
        <Botao
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          titulo="Linha divisória"
        >
          <Minus className="size-3.5" />
        </Botao>
        <Botao
          ativo={editor.isActive('link')}
          onClick={() => aplicarLink(editor)}
          titulo="Link"
        >
          <Link2 className="size-3.5" />
        </Botao>
      </Grupo>

      <Grupo semDivisor>
        <Botao
          onClick={() => editor.chain().focus().undo().run()}
          titulo="Desfazer"
          desabilitado={!editor.can().undo()}
        >
          <Undo2 className="size-3.5" />
        </Botao>
        <Botao
          onClick={() => editor.chain().focus().redo().run()}
          titulo="Refazer"
          desabilitado={!editor.can().redo()}
        >
          <Redo2 className="size-3.5" />
        </Botao>
      </Grupo>
    </div>
  )
}

/** Pede o endereço e aplica no trecho selecionado. */
function aplicarLink(editor: Editor) {
  const atual = editor.getAttributes('link').href as string | undefined
  const url = window.prompt('Endereço do link', atual ?? 'https://')
  if (url === null) return
  if (url.trim() === '') {
    editor.chain().focus().unsetLink().run()
    return
  }
  editor.chain().focus().setLink({ href: url.trim() }).run()
}

function Grupo({ children, semDivisor }: { children: ReactNode; semDivisor?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-0.5',
        !semDivisor && 'border-border-base mr-1 border-r pr-1.5',
      )}
    >
      {children}
    </div>
  )
}

function Botao({
  children,
  onClick,
  titulo,
  ativo,
  desabilitado,
}: {
  children: ReactNode
  onClick: () => void
  titulo: string
  ativo?: boolean
  desabilitado?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      aria-pressed={ativo}
      disabled={desabilitado}
      className={cn(
        'flex size-7 items-center justify-center rounded-md transition-colors disabled:opacity-30',
        ativo ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:bg-surface hover:text-fg',
      )}
    >
      {children}
    </button>
  )
}

/**
 * Botão com as cores penduradas embaixo.
 *
 * `<details>` em vez de estado no React: fecha sozinho ao clicar fora, funciona
 * pelo teclado e não custa um `useState` por paleta — três paletas seriam três
 * estados fazendo a mesma coisa.
 */
function Paleta({
  children,
  titulo,
  amostra,
  cores,
  aoEscolher,
}: {
  children: ReactNode
  titulo: string
  /** A cor em uso, mostrada na tarja sob o botão. */
  amostra: string
  cores: ReadonlyArray<{ nome: string; valor: string | null }>
  aoEscolher: (cor: string | null) => void
}) {
  return (
    <details className="relative">
      <summary
        title={titulo}
        aria-label={titulo}
        className="text-fg-muted hover:bg-surface hover:text-fg flex size-7 cursor-pointer flex-col items-center justify-center rounded-md transition-colors [&::-webkit-details-marker]:hidden"
      >
        {children}
        <span
          className="mt-px h-0.5 w-3.5 rounded-full"
          style={{ background: amostra }}
          aria-hidden
        />
      </summary>
      <div className="border-border-base bg-surface absolute top-8 left-0 z-20 w-48 rounded-lg border p-1 shadow-lg">
        {cores.map((cor) => (
          <button
            key={cor.nome}
            type="button"
            onMouseDown={(e) => {
              // A seleção do editor se perde se o foco sair antes do comando.
              e.preventDefault()
              aoEscolher(cor.valor)
              e.currentTarget.closest('details')?.removeAttribute('open')
            }}
            className="text-fg hover:bg-surface-2 flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs"
          >
            {/*
              A amostra de "Padrão" usa `currentColor`: ela mostra a cor que o
              texto teria, que é o que a opção significa. Um quadrado vazio
              pareceria "sem cor", e não é isso — é "a cor do tema".

              A borda vale para todas por causa do branco e do preto: um deles
              sempre se confunde com o fundo, dependendo do tema aberto.
            */}
            <span
              className="border-border-strong size-3.5 shrink-0 rounded border"
              style={{ background: cor.valor ?? 'currentColor' }}
            />
            {cor.nome}
          </button>
        ))}
      </div>
    </details>
  )
}
