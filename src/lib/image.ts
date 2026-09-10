/**
 * Redução de imagem para caber dentro de um registro.
 *
 * Toda tabela do app vira JSON — no SQLite, no `localStorage` ou no arquivo da
 * pasta de trabalho —, então imagem viaja como `data:` URL dentro da própria
 * linha. Isso a mantém no backup e na sincronização da pasta sem inventar um
 * segundo lugar de armazenamento, mas obriga a reduzi-la antes: uma foto de
 * celular tem 4 MB e estouraria a cota do navegador sozinha.
 *
 * A redução é feita em duas frentes — lado maior limitado e qualidade caindo em
 * degraus até caber no orçamento. Sai sempre JPEG: PNG de captura de tela não
 * comprime, e fotografia é o caso de uso aqui.
 *
 * Certificado e foto de perfil compartilham este módulo. Eram a mesma escada de
 * qualidade escrita duas vezes, e duas cópias divergem no primeiro ajuste.
 */

const QUALIDADES = [0.82, 0.72, 0.62, 0.5, 0.4]

export class ImagemInvalida extends Error {}

/** Bytes que o `data:` URL ocupa — base64 são 4 caracteres a cada 3 bytes. */
export function tamanhoAproximado(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.round((base64.length * 3) / 4)
}

/**
 * Desenha num canvas do tamanho pedido e devolve o JPEG mais nítido que couber
 * em `maxBytes`, ou `null` quando nem a menor qualidade cabe.
 *
 * Devolver nulo em vez de lançar é de propósito: quem chama sabe o que estava
 * comprimindo e escreve um recado útil — o que dizer de um certificado grande
 * demais não serve para uma foto de perfil.
 *
 * O fundo branco é obrigatório: JPEG não tem transparência, e um PNG recortado
 * ficaria com o fundo preto.
 */
export async function comprimirJpeg(
  largura: number,
  altura: number,
  maxBytes: number,
  desenhar: (contexto: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void | Promise<void>,
): Promise<string | null> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(largura))
  canvas.height = Math.max(1, Math.round(altura))

  const contexto = canvas.getContext('2d')
  if (!contexto) throw new ImagemInvalida('Não foi possível processar o arquivo.')

  contexto.fillStyle = '#ffffff'
  contexto.fillRect(0, 0, canvas.width, canvas.height)
  await desenhar(contexto, canvas)

  for (const qualidade of QUALIDADES) {
    const url = canvas.toDataURL('image/jpeg', qualidade)
    if (tamanhoAproximado(url) <= maxBytes) return url
  }

  return null
}

/** Escala que faz o lado maior caber no limite. Nunca amplia. */
export function escalaPara(largura: number, altura: number, ladoMaximo: number): number {
  return Math.min(1, ladoMaximo / Math.max(largura, altura))
}

export function carregarImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const endereco = URL.createObjectURL(arquivo)
    const imagem = new Image()
    imagem.onload = () => {
      URL.revokeObjectURL(endereco)
      resolve(imagem)
    }
    imagem.onerror = () => {
      URL.revokeObjectURL(endereco)
      reject(new ImagemInvalida('Não foi possível ler o arquivo escolhido.'))
    }
    imagem.src = endereco
  })
}
