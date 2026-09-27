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
 *
 * Os botões moram em `barra-de-formatacao.tsx`. O que fica aqui é a definição
 * do que o editor sabe fazer, que é o que se procura ao vir entender a tela.
 */

import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { TaskItem } from '@tiptap/extension-task-item'
import { TaskList } from '@tiptap/extension-task-list'
import { TextStyle } from '@tiptap/extension-text-style'
import { Placeholder } from '@tiptap/extensions'
import { Extension } from '@tiptap/core'
import { TableKit } from '@tiptap/extension-table'
import { EditorContent, useEditor } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useAjusteAoConteudo } from './ajuste-da-coluna'
import { aplicarLink } from './aplicar-link'
import { Barra } from './barra-de-formatacao'
import { Alternavel, AlternavelTitulo, Destaque } from './blocos-notion'
import { LinkSuggestions, type Sugestao } from './link-autocomplete'
import { useWikilinkNoEditor } from './wikilink-editor'
import { SublinhadoColorido } from './sublinhado-colorido'

export function RichEditor({
  content,
  onChange,
  placeholder = 'Escreva aqui. Selecione um trecho para formatar.',
  className,
  notas = [],
}: {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  /** As outras anotações, para o autocompletar de `[[`. */
  notas?: Sugestao[]
}) {
  /*
    O editor precisa do tratador de teclas na criação, e o tratador precisa do
    editor para existir. A referência corta o nó: o editor pergunta a ela, e ela
    aponta para o tratador atual assim que ele existe.
  */
  const teclaDoLink = useRef<(evento: KeyboardEvent) => boolean>(() => false)

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
      Alternavel,
      AlternavelTitulo,
      Destaque,
      AtalhoDoLink,
      // Redimensionável: largura de coluna é a primeira coisa que se ajusta
      // numa tabela de verdade, e sem isso a coluna de "Sim/Não" fica do mesmo
      // tamanho da de descrição.
      TableKit.configure({ table: { resizable: true } }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    /*
      Sem isto a tela só se redesenha quando o texto muda, e mexer o cursor não
      muda texto: o negrito continuava aceso depois de sair do trecho em
      negrito, os comandos de tabela só apareciam no primeiro caractere digitado
      dentro dela, e o "−" das alças ficava parado na coluna anterior. A barra
      inteira é feita de `isActive`, que é justamente o que depende de onde o
      cursor está.
    */
    shouldRerenderOnTransaction: true,
    // O conteúdo é do próprio usuário e nunca vem de fora; a sanitização
    // acontece na leitura, em `NoteHtml`.
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: 'prose-notes tiptap-area' },
      // A lista de sugestões responde primeiro: o Enter que confirma o link não
      // pode virar quebra de parágrafo, e a seta que move a seleção não pode
      // mover o cursor junto.
      handleKeyDown: (_, evento) => teclaDoLink.current(evento),
    },
  })

  const links = useWikilinkNoEditor(editor, notas)
  useAjusteAoConteudo(editor)
  useEffect(() => {
    teclaDoLink.current = links.teclou
  }, [links.teclou])

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
    <div className={cn('relative flex min-h-0 flex-1 flex-col', className)}>
      <Barra editor={editor} />
      <EditorContent editor={editor} className="min-h-0 flex-1 overflow-y-auto px-5 py-4" />
      {links.aberto && (
        <LinkSuggestions
          opcoes={links.opcoes}
          criar={links.criar}
          termo={links.termo}
          indice={links.indice}
          onEscolher={links.escolher}
        />
      )}
    </div>
  )
}

/**
 * `Ctrl+K` para o link, como em todo editor de texto.
 *
 * O mesmo atalho abre o "Registrar rápido" no app inteiro. Dentro do editor
 * quem ganha é o link — e é o `preventDefault` que o ProseMirror dispara ao
 * tratar a tecla que avisa o atalho global para não responder.
 */
const AtalhoDoLink = Extension.create({
  name: 'atalhoDoLink',
  addKeyboardShortcuts() {
    return {
      'Mod-k': () => {
        aplicarLink(this.editor)
        return true
      },
    }
  },
})
