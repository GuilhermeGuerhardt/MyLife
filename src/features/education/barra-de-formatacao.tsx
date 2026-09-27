/**
 * A barra de formatação do editor do caderno.
 *
 * Saiu do `rich-editor.tsx` por tamanho: os botões eram dois terços do arquivo,
 * e a configuração do editor — que é o que se vai ler para entender como a
 * anotação funciona — ficava enterrada no meio deles.
 *
 * Aqui só há botão e comando. Quem decide o que o editor sabe fazer continua no
 * outro arquivo, e é de lá que esta barra recebe o `editor` pronto.
 */

import type { Editor } from '@tiptap/react'
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  BetweenHorizonalStart,
  BetweenVerticalStart,
  ChevronsUpDown,
  Columns3,
  Combine,
  Link2,
  PanelLeft,
  List,
  ListOrdered,
  ListTodo,
  Lightbulb,
  Minus,
  Rows3,
  Table as TableIcon,
  Trash2,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useMenuFlutuante } from '@/components/ui/use-menu-flutuante'
import { atalho } from '@/lib/atalho'
import { cn } from '@/lib/utils'
import { aplicarLink } from './aplicar-link'
import { alternavelVazio, ALTERNAVEL, destaqueVazio, DESTAQUE } from './blocos-notion'
import { excluirTabela } from './excluir-tabela'

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


export function Barra({ editor }: { editor: Editor }) {
  return (
    <div className="border-border-base bg-surface-2 flex flex-wrap items-center gap-0.5 border-b px-3 py-1.5">
      <Grupo>
        <Botao
          ativo={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          titulo="Negrito"
          teclas="mod+b"
        >
          <Bold className="size-3.5" />
        </Botao>
        <Botao
          ativo={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          titulo="Itálico"
          teclas="mod+i"
        >
          <Italic className="size-3.5" />
        </Botao>
        <Botao
          ativo={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          titulo="Sublinhado"
          teclas="mod+u"
        >
          <UnderlineIcon className="size-3.5" />
        </Botao>
        <Botao
          ativo={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          titulo="Riscado"
          teclas="mod+shift+s"
        >
          <Strikethrough className="size-3.5" />
        </Botao>
        <Botao
          ativo={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
          titulo="Código"
          teclas="mod+e"
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
          teclas="mod+shift+h"
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
              teclas={`mod+alt+${nivel}`}
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
          teclas="mod+shift+8"
        >
          <List className="size-3.5" />
        </Botao>
        <Botao
          ativo={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          titulo="Lista numerada"
          teclas="mod+shift+7"
        >
          <ListOrdered className="size-3.5" />
        </Botao>
        <Botao
          ativo={editor.isActive('taskList')}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          titulo="Lista de tarefas"
          teclas="mod+shift+9"
        >
          <ListTodo className="size-3.5" />
        </Botao>
        <Botao
          ativo={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          titulo="Citação"
          teclas="mod+shift+b"
        >
          <Quote className="size-3.5" />
        </Botao>
        <Botao
          ativo={editor.isActive(ALTERNAVEL)}
          onClick={() => editor.chain().focus().insertContent(alternavelVazio()).run()}
          titulo="Bloco alternável — esconde o que vem embaixo"
          teclas="mod+alt+t"
        >
          <ChevronsUpDown className="size-3.5" />
        </Botao>
        <Botao
          ativo={editor.isActive(DESTAQUE)}
          onClick={() => editor.chain().focus().insertContent(destaqueVazio()).run()}
          titulo="Destaque — o que não pode passar batido"
          teclas="mod+alt+d"
        >
          <Lightbulb className="size-3.5" />
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
          teclas="mod+k"
        >
          <Link2 className="size-3.5" />
        </Botao>
        <Botao
          ativo={editor.isActive('table')}
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
          titulo="Tabela"
        >
          <TableIcon className="size-3.5" />
        </Botao>
      </Grupo>

      {/*
        Os comandos da tabela só existem dentro de uma. Deixá-los sempre à vista
        seria sete botões apagados ocupando a barra em toda anotação que não tem
        tabela nenhuma — e eles são justamente o que se procura quando há uma.
      */}
      {editor.isActive('table') && (
        <Grupo>
          <Botao
            onClick={() => editor.chain().focus().addRowAfter().run()}
            titulo="Linha abaixo"
          >
            <BetweenHorizonalStart className="size-3.5" />
          </Botao>
          <Botao
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            titulo="Coluna à direita"
          >
            <BetweenVerticalStart className="size-3.5" />
          </Botao>
          <Botao
            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
            titulo="Primeira linha como cabeçalho"
          >
            <Heading1 className="size-3.5" />
          </Botao>
          {/* Em tabela de comparação quem nomeia é a coluna da esquerda, não a
              linha de cima. Só o cabeçalho de linha existia. */}
          <Botao
            onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
            titulo="Primeira coluna como cabeçalho"
          >
            <PanelLeft className="size-3.5" />
          </Botao>
          {/* Um botão só: com várias células escolhidas ele junta, e dentro de
              uma célula já mesclada ele desfaz. Dois botões, um deles sempre
              apagado, diriam a mesma coisa ocupando o dobro. */}
          <Botao
            onClick={() => editor.chain().focus().mergeOrSplit().run()}
            titulo="Mesclar as células escolhidas, ou dividir a mesclada"
            desabilitado={!editor.can().mergeOrSplit()}
          >
            <Combine className="size-3.5" />
          </Botao>
        </Grupo>
      )}

      {/*
        As três exclusões andam juntas e em vermelho. Espalhadas no meio dos
        botões de montar a tabela, com o mesmo cinza e um ícone que lembra o de
        adicionar, elas não se achavam: era preciso passar o mouse em cada um
        para descobrir qual apagava o quê.
      */}
      {editor.isActive('table') && (
        <Grupo>
          <Botao
            perigo
            onClick={() => editor.chain().focus().deleteRow().run()}
            titulo="Excluir a linha do cursor"
          >
            <Rows3 className="size-3.5" />
          </Botao>
          <Botao
            perigo
            onClick={() => editor.chain().focus().deleteColumn().run()}
            titulo="Excluir a coluna do cursor"
          >
            <Columns3 className="size-3.5" />
          </Botao>
          <Botao
            perigo
            onClick={() => excluirTabela(editor)}
            titulo="Excluir a tabela inteira"
          >
            <Trash2 className="size-3.5" />
          </Botao>
        </Grupo>
      )}

      <Grupo semDivisor>
        <Botao
          onClick={() => editor.chain().focus().undo().run()}
          titulo="Desfazer"
          teclas="mod+z"
          desabilitado={!editor.can().undo()}
        >
          <Undo2 className="size-3.5" />
        </Botao>
        <Botao
          onClick={() => editor.chain().focus().redo().run()}
          titulo="Refazer"
          teclas="mod+shift+z"
          desabilitado={!editor.can().redo()}
        >
          <Redo2 className="size-3.5" />
        </Botao>
      </Grupo>
    </div>
  )
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
  teclas,
  ativo,
  desabilitado,
  perigo,
}: {
  children: ReactNode
  onClick: () => void
  titulo: string
  /** O atalho, em `mod+b`. Aparece na dica — atalho escondido não existe. */
  teclas?: string
  ativo?: boolean
  desabilitado?: boolean
  /** Apaga alguma coisa: o vermelho avisa antes de a dica ser lida. */
  perigo?: boolean
}) {
  const dica = teclas ? `${titulo} · ${atalho(teclas)}` : titulo

  return (
    <button
      type="button"
      onClick={onClick}
      title={dica}
      aria-label={dica}
      aria-pressed={ativo}
      disabled={desabilitado}
      className={cn(
        'flex size-7 items-center justify-center rounded-md transition-colors disabled:opacity-30',
        ativo && 'bg-accent-soft text-accent',
        !ativo && perigo && 'text-negative/80 hover:bg-negative/10 hover:text-negative',
        !ativo && !perigo && 'text-fg-muted hover:bg-surface hover:text-fg',
      )}
    >
      {children}
    </button>
  )
}

/**
 * Botão com as cores penduradas embaixo.
 *
 * `<details>` em vez de estado no React: funciona pelo teclado e não custa um
 * `useState` por paleta — três paletas seriam três estados fazendo a mesma
 * coisa. O fechar ao clicar fora é a única parte que ele não traz de fábrica, e
 * vem de `useMenuFlutuante`.
 */
function Paleta({
  children,
  titulo,
  teclas,
  amostra,
  cores,
  aoEscolher,
}: {
  children: ReactNode
  titulo: string
  /** O atalho, quando a marca tem um. A cor em si não tem tecla. */
  teclas?: string
  /** A cor em uso, mostrada na tarja sob o botão. */
  amostra: string
  cores: ReadonlyArray<{ nome: string; valor: string | null }>
  aoEscolher: (cor: string | null) => void
}) {
  const paleta = useMenuFlutuante()

  return (
    <details ref={paleta} className="relative">
      <summary
        title={teclas ? `${titulo} · ${atalho(teclas)}` : titulo}
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
