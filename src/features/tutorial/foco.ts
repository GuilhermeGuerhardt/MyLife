/**
 * Onde o holofote do guia cai, e onde o balão cabe.
 *
 * A conta fica fora do componente porque é ela que erra: balão que sai pela
 * borda da tela, seta apontando para o lugar errado, passo preso num elemento
 * que não existe naquela largura. Aqui dá para testar sem navegador.
 */

export interface Retangulo {
  top: number
  left: number
  width: number
  height: number
}

export interface Tela {
  largura: number
  altura: number
}

export type LadoDoBalao = 'acima' | 'abaixo' | 'centro'

export interface PosicaoDoBalao {
  lado: LadoDoBalao
  /** Cantos em pixels, já limitados à tela. */
  top: number
  left: number
}

/** Respiro entre o alvo e o balão, e entre o balão e a borda da tela. */
const FOLGA = 12
const MARGEM = 16

/**
 * Escolhe abaixo do alvo, acima, ou o centro da tela.
 *
 * Abaixo é o padrão porque o texto é lido de cima para baixo e o alvo fica no
 * campo de visão junto. Não cabendo dos dois lados — alvo alto numa tela baixa,
 * ou um passo sem alvo nenhum —, o balão vai para o meio da tela e o holofote
 * some: melhor um cartão centrado do que uma seta apontando para fora.
 */
export function posicionarBalao(
  alvo: Retangulo | null,
  balao: { largura: number; altura: number },
  tela: Tela,
): PosicaoDoBalao {
  if (!alvo) {
    return {
      lado: 'centro',
      top: Math.max(MARGEM, (tela.altura - balao.altura) / 2),
      left: Math.max(MARGEM, (tela.largura - balao.largura) / 2),
    }
  }

  const abaixo = alvo.top + alvo.height + FOLGA
  const acima = alvo.top - balao.altura - FOLGA
  const cabeAbaixo = abaixo + balao.altura + MARGEM <= tela.altura
  const cabeAcima = acima >= MARGEM

  if (!cabeAbaixo && !cabeAcima) {
    return {
      lado: 'centro',
      top: Math.max(MARGEM, (tela.altura - balao.altura) / 2),
      left: Math.max(MARGEM, (tela.largura - balao.largura) / 2),
    }
  }

  // Alinha o balão pelo centro do alvo e traz de volta para dentro da tela.
  const centro = alvo.left + alvo.width / 2 - balao.largura / 2
  const left = Math.min(Math.max(centro, MARGEM), Math.max(MARGEM, tela.largura - balao.largura - MARGEM))

  return { lado: cabeAbaixo ? 'abaixo' : 'acima', top: cabeAbaixo ? abaixo : acima, left }
}

/** O recorte do holofote, com uma folga em volta do alvo. */
export function recorte(alvo: Retangulo, folga = 6): Retangulo {
  return {
    top: alvo.top - folga,
    left: alvo.left - folga,
    width: alvo.width + folga * 2,
    height: alvo.height + folga * 2,
  }
}

/**
 * Se o alvo está visível o bastante para valer um holofote.
 *
 * Elemento de largura zero é o que está escondido pelo CSS naquela largura de
 * tela — o menu lateral no celular, por exemplo. Apontar para ele desenharia um
 * buraco de nada num canto qualquer.
 */
export function vale(alvo: Retangulo | null): alvo is Retangulo {
  return alvo !== null && alvo.width > 8 && alvo.height > 8
}
