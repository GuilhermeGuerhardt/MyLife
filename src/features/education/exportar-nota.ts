/**
 * Levar uma anotação para fora do Life.
 *
 * O menu oferece o que o formato da anotação sabe entregar: Markdown exporta
 * `.md` e `.txt`; texto formatado exporta `.docx`, PDF e `.txt`. Oferecer o
 * cruzado seria prometer uma conversão que perde justamente cor, marca-texto e
 * cor do sublinhado — o que o editor formatado veio acrescentar.
 *
 * O `docx` é a única biblioteca aqui, e entra por `import()`: quem nunca
 * exporta para Word nunca a baixa.
 */

import type { FormatoDaNota } from '@/lib/education/formato'
import {
  blocosDoHtml,
  blocosParaTexto,
  markdownParaTexto,
  nomeDeArquivo,
  textoDoBloco,
  type Bloco,
  type Marcas,
} from '@/lib/education/documento'
import { salvarArquivo, type TipoArquivo } from '@/lib/salvar-arquivo'

export type FormatoDeSaida = 'md' | 'txt' | 'docx' | 'pdf'

const MARKDOWN: TipoArquivo = {
  nome: 'Markdown',
  extensoes: ['md'],
  mime: 'text/markdown;charset=utf-8',
}

const TEXTO: TipoArquivo = {
  nome: 'Texto',
  extensoes: ['txt'],
  mime: 'text/plain;charset=utf-8',
}

const WORD: TipoArquivo = {
  nome: 'Documento do Word',
  extensoes: ['docx'],
  mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

/** O que cada formato de anotação sabe entregar. */
export function saidasPossiveis(formato: FormatoDaNota): FormatoDeSaida[] {
  return formato === 'html' ? ['docx', 'pdf', 'txt'] : ['md', 'txt']
}

export const ROTULOS: Record<FormatoDeSaida, string> = {
  md: 'Markdown (.md)',
  txt: 'Texto puro (.txt)',
  docx: 'Word (.docx)',
  pdf: 'PDF',
}

export async function exportarNota(
  titulo: string,
  conteudo: string,
  formato: FormatoDaNota,
  saida: FormatoDeSaida,
): Promise<boolean> {
  const nome = nomeDeArquivo(titulo)

  if (saida === 'md') return salvarArquivo(`${nome}.md`, conteudo, MARKDOWN)

  if (saida === 'txt') {
    const texto =
      formato === 'html' ? blocosParaTexto(blocosDoHtml(conteudo)) : markdownParaTexto(conteudo)
    return salvarArquivo(`${nome}.txt`, `${titulo}\n\n${texto}`, TEXTO)
  }

  if (saida === 'docx') {
    const bytes = await montarDocx(titulo, blocosDoHtml(conteudo))
    return salvarArquivo(`${nome}.docx`, bytes, WORD)
  }

  imprimir(titulo, conteudo)
  return true
}

// ---------------------------------------------------------------------------
// Word
// ---------------------------------------------------------------------------

/** `#rrggbb` para `RRGGBB`, que é como o Word quer a cor. */
function corDoWord(cor: string | undefined): string | undefined {
  if (!cor) return undefined
  const hex = /^#?([0-9a-f]{6})$/i.exec(cor.trim())
  if (hex) return hex[1]!.toUpperCase()
  // O editor às vezes devolve `rgb(0, 145, 255)`.
  const rgb = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(cor)
  if (!rgb) return undefined
  return [rgb[1], rgb[2], rgb[3]]
    .map((n) => Number(n).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

async function montarDocx(titulo: string, blocos: Bloco[]): Promise<Uint8Array> {
  const {
    AlignmentType,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    TextRun,
    UnderlineType,
  } = await import('docx')

  const NIVEIS = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ]

  const trechos = (bloco: Bloco, prefixo = '') => {
    const corridos = bloco.trechos.map((t) => runDoTrecho(t.texto, t.marcas))
    return prefixo ? [new TextRun({ text: prefixo }), ...corridos] : corridos
  }

  const runDoTrecho = (texto: string, marcas: Marcas) =>
    new TextRun({
      text: texto,
      bold: marcas.negrito,
      italics: marcas.italico,
      strike: marcas.riscado,
      font: marcas.codigo ? 'Consolas' : undefined,
      color: corDoWord(marcas.cor),
      highlight: marcas.fundo ? 'yellow' : undefined,
      underline: marcas.sublinhado
        ? { type: UnderlineType.SINGLE, color: corDoWord(marcas.corDoSublinhado) }
        : undefined,
    })

  const paragrafos: InstanceType<typeof Paragraph>[] = [
    new Paragraph({ text: titulo, heading: HeadingLevel.TITLE }),
  ]

  for (const bloco of blocos) {
    const recuo = bloco.recuo ? { left: 360 * (bloco.recuo + 1) } : undefined

    switch (bloco.tipo) {
      case 'titulo':
        paragrafos.push(
          new Paragraph({ children: trechos(bloco), heading: NIVEIS[(bloco.nivel ?? 1) - 1] }),
        )
        break
      case 'item':
        paragrafos.push(
          new Paragraph({ children: trechos(bloco), bullet: { level: bloco.recuo ?? 0 } }),
        )
        break
      case 'item-numerado':
        // Sem numeração automática de propósito: o `docx` exige declarar um
        // `numbering` no documento, e uma lista que reinicia errado no Word é
        // pior que um marcador simples.
        paragrafos.push(
          new Paragraph({ children: trechos(bloco), bullet: { level: bloco.recuo ?? 0 } }),
        )
        break
      case 'tarefa':
        // O Word não tem caixa de marcar em texto corrido; o símbolo é o que
        // sobrevive a abrir o arquivo em qualquer lugar.
        paragrafos.push(
          new Paragraph({
            children: trechos(bloco, bloco.feita ? '☑  ' : '☐  '),
            indent: recuo,
          }),
        )
        break
      case 'citacao':
        paragrafos.push(
          new Paragraph({
            children: trechos(bloco),
            indent: { left: 720 },
            border: { left: { style: 'single', size: 12, color: 'BBBBBB', space: 12 } },
          }),
        )
        break
      case 'codigo':
        for (const linha of textoDoBloco(bloco).split('\n')) {
          paragrafos.push(
            new Paragraph({
              children: [new TextRun({ text: linha, font: 'Consolas', size: 20 })],
              shading: { fill: 'F4F4F5' },
            }),
          )
        }
        break
      case 'linha':
        paragrafos.push(
          new Paragraph({ text: '', border: { bottom: { style: 'single', size: 6, color: 'CCCCCC' } } }),
        )
        break
      default:
        paragrafos.push(new Paragraph({ children: trechos(bloco), indent: recuo, alignment: AlignmentType.LEFT }))
    }
  }

  const doc = new Document({ sections: [{ children: paragrafos }] })
  return Packer.toBuffer(doc) as unknown as Promise<Uint8Array>
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/**
 * PDF pela caixa de impressão do sistema.
 *
 * Sem biblioteca: as que geram PDF direto custam de 500 kB a 2 MB, e as leves
 * rasterizam — o texto vira imagem e deixa de ser selecionável ou pesquisável,
 * que é metade da razão de se ter um PDF. A caixa de impressão do Windows já
 * traz "Salvar como PDF" e sai por zero byte.
 *
 * Num quadro escondido, e não numa janela nova: `window.open` não abre dentro
 * da janela nativa do Tauri, e imprimir a página do app levaria a barra
 * lateral, os botões e o resto do caderno junto para o papel.
 */
function imprimir(titulo: string, html: string): void {
  const quadro = quadroDeImpressao()
  const doc = quadro.contentDocument
  if (!doc) return

  doc.open()
  doc.write(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${escaparHtml(titulo)}</title>
<style>
  @page { margin: 2cm; }
  body { font: 11pt/1.6 Calibri, "Segoe UI", system-ui, sans-serif; color: #111; }
  h1 { font-size: 20pt; margin: 0 0 1.2rem; }
  h2 { font-size: 15pt; margin: 1.6rem 0 .5rem; }
  h3 { font-size: 13pt; margin: 1.3rem 0 .4rem; }
  blockquote { margin: 1rem 0; padding-left: 1rem; border-left: 3px solid #ccc; color: #444; }
  pre { background: #f4f4f5; padding: .8rem; border-radius: 4px; font: 9.5pt/1.5 Consolas, monospace; white-space: pre-wrap; }
  code { font-family: Consolas, monospace; }
  ul[data-type="taskList"] { list-style: none; padding-left: .2rem; }
  ul[data-type="taskList"] li { display: flex; gap: .5rem; align-items: flex-start; }
  ul[data-type="taskList"] li > div > p { margin: 0; }
  li[data-checked="true"] > div { color: #666; text-decoration: line-through; }
  a { color: #0b5cad; }
  /* Título e primeira linha nunca ficam sozinhos no fim da página. */
  h1, h2, h3 { break-after: avoid; }
  p, li { orphans: 2; widows: 2; }
</style></head>
<body><h1>${escaparHtml(titulo)}</h1>${html}</body></html>`)
  doc.close()

  // O `document.write` nem sempre dispara `load` — o tempo curto é a garantia
  // de que a caixa abre mesmo assim, e a trava impede que abra duas vezes.
  let aberta = false
  const abrir = () => {
    if (aberta) return
    aberta = true
    quadro.contentWindow?.focus()
    quadro.contentWindow?.print()
  }
  quadro.addEventListener('load', abrir, { once: true })
  setTimeout(abrir, 300)
}

/**
 * O quadro escondido, um só para o app inteiro.
 *
 * Fica de pé depois de imprimir em vez de ser removido: a caixa de impressão
 * do Windows não avisa quando fecha, e tirar o quadro debaixo dela cancelaria a
 * impressão no meio. O conteúdo é reescrito na exportação seguinte.
 */
function quadroDeImpressao(): HTMLIFrameElement {
  const existente = document.getElementById(ID_IMPRESSAO)
  if (existente instanceof HTMLIFrameElement) return existente

  const quadro = document.createElement('iframe')
  quadro.id = ID_IMPRESSAO
  quadro.setAttribute('aria-hidden', 'true')
  quadro.setAttribute('title', 'Impressão')
  quadro.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.append(quadro)
  return quadro
}

const ID_IMPRESSAO = 'life-impressao'

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
