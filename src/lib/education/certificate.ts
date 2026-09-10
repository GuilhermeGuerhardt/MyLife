/**
 * Certificado do curso: o arquivo que fica guardado junto do registro.
 *
 * Toda tabela do app vira JSON — no SQLite, no `localStorage` ou no arquivo da
 * pasta de trabalho —, então o certificado viaja como `data:` URL dentro da
 * própria linha. Isso o mantém no backup e na sincronização da pasta sem
 * inventar um segundo lugar de armazenamento, mas obriga a caber num orçamento.
 *
 * São dois tipos de arquivo aceitos, e cada um vira uma coisa diferente:
 *
 * - **Imagem** (PNG, JPG, WEBP): reduzida e guardada. Ela é o certificado.
 * - **PDF**: guardado inteiro, e mais uma imagem da primeira página. O PDF é o
 *   documento que vale — o que se reenvia para uma empresa —, e a imagem é o
 *   que o cartão consegue mostrar em 44 px.
 *
 * A biblioteca de PDF só é baixada quando alguém envia um PDF: ela pesa mais
 * que várias telas do app somadas, e a maioria dos certificados é imagem.
 */

/** Lado maior da imagem guardada, em pixels. */
const LADO_MAXIMO = 1400

/** Teto do `data:` URL da imagem. Acima disso a cota do navegador aperta. */
export const CERTIFICADO_MAX_BYTES = 700_000

/**
 * Teto do PDF original.
 *
 * Mais generoso que o da imagem porque não dá para recomprimir um PDF sem
 * reescrevê-lo, e ainda cabe: no modo navegador o app inteiro dispõe de uns
 * 5 MB, e certificado costuma ter entre 100 e 500 kB.
 */
export const PDF_MAX_BYTES = 1_500_000

const QUALIDADES = [0.82, 0.72, 0.62, 0.5, 0.4]

export const CERTIFICADO_ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf'

export class CertificadoInvalido extends Error {}

export interface Certificado {
  /** O que o cartão mostra: a imagem reduzida, ou a primeira página do PDF. */
  imagem: string
  /** O PDF original, quando o arquivo enviado foi um PDF. */
  pdf: string | null
}

/** Converte o arquivo escolhido no que vai para o registro do curso. */
export async function arquivoParaCertificado(arquivo: File): Promise<Certificado> {
  if (arquivo.type === 'application/pdf') return pdfParaCertificado(arquivo)
  if (arquivo.type.startsWith('image/')) {
    return { imagem: await imagemParaCertificado(arquivo), pdf: null }
  }
  throw new CertificadoInvalido('Escolha uma imagem (PNG, JPG ou WEBP) ou um PDF.')
}

/**
 * Reduz a imagem até caber no orçamento.
 *
 * Sempre sai JPEG: PNG de captura de tela não comprime, e o certificado é uma
 * imagem fotográfica — o formato com perdas é o que faz caber.
 */
async function imagemParaCertificado(arquivo: File): Promise<string> {
  const imagem = await carregarImagem(arquivo)
  return desenharEComprimir(imagem.width, imagem.height, (contexto, largura, altura) => {
    contexto.drawImage(imagem, 0, 0, largura, altura)
  })
}

/** Guarda o PDF e desenha a primeira página como miniatura. */
async function pdfParaCertificado(arquivo: File): Promise<Certificado> {
  if (arquivo.size > PDF_MAX_BYTES) {
    throw new CertificadoInvalido(
      `Este PDF tem ${Math.round(arquivo.size / 1024)} kB e o limite é ${Math.round(
        PDF_MAX_BYTES / 1024,
      )} kB. Comprima o arquivo ou envie uma foto do certificado.`,
    )
  }

  const dados = await arquivo.arrayBuffer()

  // A cópia existe porque o pdf.js assume o controle do buffer que recebe e o
  // deixa vazio ao terminar — e é do mesmo conteúdo que sai o `data:` URL.
  const paraGuardar = dados.slice(0)

  const pagina = await primeiraPagina(new Uint8Array(dados))

  const imagem = await desenharEComprimir(
    pagina.width,
    pagina.height,
    // O canvas sai proporcional à página, então uma escala descreve os dois lados.
    async (_contexto, largura, _altura, canvas) => {
      await pagina.desenhar(canvas, largura / pagina.width)
    },
  )

  return { imagem, pdf: paraDataUrl(paraGuardar, 'application/pdf') }
}

interface PaginaPdf {
  width: number
  height: number
  desenhar: (canvas: HTMLCanvasElement, escala: number) => Promise<void>
}

async function primeiraPagina(dados: Uint8Array): Promise<PaginaPdf> {
  let pdfjs: typeof import('pdfjs-dist')
  try {
    pdfjs = await import('pdfjs-dist')
    // O worker vem do próprio pacote, empacotado pelo Vite: o app roda offline
    // e não pode depender de CDN para abrir um certificado.
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  } catch {
    throw new CertificadoInvalido('Não foi possível carregar o leitor de PDF.')
  }

  // A tarefa de carregamento é guardada porque é ela que sabe se desmontar: o
  // documento em si não tem `destroy`, e sem isso o worker fica de pé até a
  // aba fechar.
  const tarefa = pdfjs.getDocument({ data: dados })

  let documento: Awaited<typeof tarefa.promise>
  try {
    documento = await tarefa.promise
  } catch {
    await tarefa.destroy()
    throw new CertificadoInvalido(
      'Não consegui ler este PDF. Ele pode estar protegido por senha ou corrompido.',
    )
  }

  const pagina = await documento.getPage(1)
  const base = pagina.getViewport({ scale: 1 })

  return {
    width: base.width,
    height: base.height,
    desenhar: async (canvas, escala) => {
      const viewport = pagina.getViewport({ scale: escala })
      await pagina.render({ canvas, viewport }).promise
      await tarefa.destroy()
    },
  }
}

/**
 * Desenha num canvas do tamanho pedido e devolve o JPEG mais nítido que couber.
 *
 * A qualidade cai em degraus até o `data:` URL entrar no orçamento; o fundo
 * branco é obrigatório porque JPEG não tem transparência, e um PNG recortado
 * ficaria preto.
 */
async function desenharEComprimir(
  larguraOriginal: number,
  alturaOriginal: number,
  desenhar: (
    contexto: CanvasRenderingContext2D,
    largura: number,
    altura: number,
    canvas: HTMLCanvasElement,
  ) => void | Promise<void>,
): Promise<string> {
  const escala = Math.min(1, LADO_MAXIMO / Math.max(larguraOriginal, alturaOriginal))
  const largura = Math.max(1, Math.round(larguraOriginal * escala))
  const altura = Math.max(1, Math.round(alturaOriginal * escala))

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura

  const contexto = canvas.getContext('2d')
  if (!contexto) throw new CertificadoInvalido('Não foi possível processar o arquivo.')

  contexto.fillStyle = '#ffffff'
  contexto.fillRect(0, 0, largura, altura)
  await desenhar(contexto, largura, altura, canvas)

  for (const qualidade of QUALIDADES) {
    const url = canvas.toDataURL('image/jpeg', qualidade)
    if (tamanhoAproximado(url) <= CERTIFICADO_MAX_BYTES) return url
  }

  throw new CertificadoInvalido(
    'O arquivo é grande demais mesmo depois de reduzido. Tente uma imagem com menos detalhe ou um recorte só do certificado.',
  )
}

function paraDataUrl(dados: ArrayBuffer, mime: string): string {
  return `data:${mime};base64,${paraBase64(new Uint8Array(dados))}`
}

/**
 * Bytes em base64, em blocos.
 *
 * `String.fromCharCode(...bytes)` de uma vez com um arquivo de 1 MB estoura o
 * limite de argumentos da chamada e derruba a aba.
 */
function paraBase64(bytes: Uint8Array): string {
  const BLOCO = 8192
  let binario = ''
  for (let i = 0; i < bytes.length; i += BLOCO) {
    binario += String.fromCharCode(...bytes.subarray(i, i + BLOCO))
  }
  return btoa(binario)
}

/** Os bytes de volta, para gravar o PDF em disco. */
export function bytesDoDataUrl(dataUrl: string): Uint8Array {
  const binario = atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

/** Bytes que o `data:` URL ocupa — base64 são 4 caracteres a cada 3 bytes. */
export function tamanhoAproximado(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.round((base64.length * 3) / 4)
}

/** Só imagem tem miniatura; um link para o portal continua sendo só link. */
export function ehImagem(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.startsWith('data:image/')
}

export function ehPdf(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.startsWith('data:application/pdf')
}

/** Nome sugerido ao salvar o PDF de volta em disco. */
export function nomeDoCertificado(curso: string): string {
  const limpo = curso
    .normalize('NFD')
    // Os acentos, já separados das letras pela normalização.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `certificado-${limpo || 'curso'}.pdf`
}

function carregarImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const endereco = URL.createObjectURL(arquivo)
    const imagem = new Image()
    imagem.onload = () => {
      URL.revokeObjectURL(endereco)
      resolve(imagem)
    }
    imagem.onerror = () => {
      URL.revokeObjectURL(endereco)
      reject(new CertificadoInvalido('Não foi possível ler o arquivo escolhido.'))
    }
    imagem.src = endereco
  })
}
