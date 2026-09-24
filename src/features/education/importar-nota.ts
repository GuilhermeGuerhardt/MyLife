/**
 * Ler o arquivo escolhido e devolver uma anotação pronta.
 *
 * As duas bibliotecas pesadas entram por `import()`: o `mammoth` só desce
 * quando alguém traz um `.docx`, e o `pdfjs` — que já servia aos certificados —
 * só quando alguém traz um PDF. Quem importa um `.md` não baixa nenhuma das
 * duas.
 */

import type { FormatoDaNota } from '@/lib/education/formato'
import {
  extensaoDoArquivo,
  formatoDeDestino,
  ImportacaoInvalida,
  IMPORTACAO_MAX_BYTES,
  limparHtmlImportado,
  textoParaHtml,
  tituloDoArquivo,
  type ExtensaoAceita,
} from '@/lib/education/importacao'

export { ImportacaoInvalida, IMPORTACAO_ACCEPT } from '@/lib/education/importacao'

export interface NotaImportada {
  title: string
  content: string
  format: FormatoDaNota
}

export async function lerArquivoDeNota(arquivo: File): Promise<NotaImportada> {
  const extensao = extensaoDoArquivo(arquivo.name)
  if (!extensao) {
    throw new ImportacaoInvalida('Escolha um arquivo .md, .txt, .docx ou .pdf.')
  }
  if (arquivo.size > IMPORTACAO_MAX_BYTES) {
    const limite = Math.round(IMPORTACAO_MAX_BYTES / 1_000_000)
    throw new ImportacaoInvalida(`Este arquivo passa de ${limite} MB — grande demais para uma anotação.`)
  }

  return {
    title: tituloDoArquivo(arquivo.name),
    content: await conteudo(arquivo, extensao),
    format: formatoDeDestino(extensao),
  }
}

async function conteudo(arquivo: File, extensao: ExtensaoAceita): Promise<string> {
  if (extensao === 'md') return (await arquivo.text()).replace(/\r\n?/g, '\n')
  if (extensao === 'txt') return textoParaHtml(await arquivo.text())
  if (extensao === 'docx') return lerDocx(arquivo)
  return textoParaHtml(await lerPdf(arquivo))
}

/**
 * O `.docx` vira HTML pelo mammoth, que lê os estilos do Word — título, lista,
 * negrito, itálico — em vez do XML cru. O que ele não reconhece vira parágrafo,
 * que é texto preservado.
 */
async function lerDocx(arquivo: File): Promise<string> {
  let mammoth: typeof import('mammoth')
  try {
    mammoth = await import('mammoth')
  } catch {
    throw new ImportacaoInvalida('Não foi possível carregar o leitor de Word.')
  }

  try {
    // O pacote tem duas metades: a do navegador lê `arrayBuffer` e a do Node —
    // que é a que os testes carregam — lê `buffer`. As duas querem os mesmos
    // bytes, então vão as duas chaves e cada build pega a sua.
    const dados = await arquivo.arrayBuffer()
    const entrada = { arrayBuffer: dados, buffer: dados } as Parameters<
      typeof mammoth.convertToHtml
    >[0]

    const { value } = await mammoth.convertToHtml(entrada)
    const html = limparHtmlImportado(value)
    if (!html) throw new ImportacaoInvalida('Este documento está vazio.')
    return html
  } catch (falha) {
    if (falha instanceof ImportacaoInvalida) throw falha
    throw new ImportacaoInvalida('Não consegui ler este documento do Word.')
  }
}

/**
 * Do PDF sai o texto, e só ele.
 *
 * Um PDF não guarda "título" nem "lista": guarda letras com coordenadas. Dá
 * para adivinhar estrutura pelo tamanho da fonte, e é justamente onde esse tipo
 * de importação costuma errar — um parágrafo virando título no meio da página.
 * O texto chega inteiro e editável; a formatação é de quem está importando.
 */
async function lerPdf(arquivo: File): Promise<string> {
  let pdfjs: typeof import('pdfjs-dist')
  try {
    pdfjs = await import('pdfjs-dist')
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  } catch {
    throw new ImportacaoInvalida('Não foi possível carregar o leitor de PDF.')
  }

  const dados = new Uint8Array(await arquivo.arrayBuffer())
  const tarefa = pdfjs.getDocument({ data: dados })

  let documento: Awaited<typeof tarefa.promise>
  try {
    documento = await tarefa.promise
  } catch {
    await tarefa.destroy()
    throw new ImportacaoInvalida(
      'Não consegui ler este PDF. Ele pode estar protegido por senha ou corrompido.',
    )
  }

  try {
    const paginas: string[] = []
    for (let n = 1; n <= documento.numPages; n++) {
      const pagina = await documento.getPage(n)
      const conteudo = await pagina.getTextContent()
      paginas.push(juntarLinhas(conteudo.items))
    }

    const texto = paginas.join('\n').trim()
    if (!texto) {
      throw new ImportacaoInvalida(
        'Este PDF não tem texto — deve ser um documento digitalizado, só com imagem.',
      )
    }
    return texto
  } finally {
    // O `destroy` derruba o worker. Sem ele, cada importação deixa um de pé
    // até a janela fechar.
    await tarefa.destroy()
  }
}

/**
 * Os pedaços de texto do pdfjs viram linhas.
 *
 * Ele entrega trechos soltos, e é o `hasEOL` de cada um que diz onde a linha
 * acabou — juntar tudo com espaço transformaria a página inteira num parágrafo
 * só.
 */
function juntarLinhas(itens: unknown[]): string {
  let texto = ''
  for (const item of itens) {
    // A lista mistura os trechos de texto com marcações de estrutura do PDF, e
    // só os primeiros têm `str`.
    if (typeof item !== 'object' || item === null || !('str' in item)) continue
    const trecho = item as { str?: string; hasEOL?: boolean }
    texto += trecho.str ?? ''
    if (trecho.hasEOL) texto += '\n'
  }
  return texto
}
