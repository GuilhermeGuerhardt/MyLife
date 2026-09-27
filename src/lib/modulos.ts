/**
 * Quais módulos aparecem no menu.
 *
 * Quem não estuda não precisa de Faculdade na barra; quem só quer o caderno não
 * precisa do resto. Esconder é do menu para fora: nada é apagado, o endereço
 * continua abrindo a tela, e mostrar de volta devolve os dados como estavam —
 * é o que separa "não uso isso" de "quero perder isso".
 *
 * Só existe ajuste gravado para o que a pessoa mexeu. Módulo novo numa versão
 * futura aparece por padrão, em vez de sumir por não ter linha no banco.
 */

export interface AjusteDeModulo {
  /** A rota do módulo, como em `NAV`. */
  modulo: string
  visible: boolean
}

export interface ModuloDaLista<T> {
  def: T
  visible: boolean
  /** Falso quando esconder não é opção — o botão fica travado, não ausente. */
  podeEsconder: boolean
}

/**
 * O Início fica: é a tela que abre o app e o caminho de volta de qualquer
 * outra. Escondê-lo deixaria a pessoa sem porta de entrada.
 */
export const FIXOS = ['/']

export function montarModulos<T extends { to: string }>(
  nav: readonly T[],
  ajustes: readonly AjusteDeModulo[],
): Array<ModuloDaLista<T>> {
  const porRota = new Map(ajustes.map((ajuste) => [ajuste.modulo, ajuste.visible]))

  return nav.map((def) => {
    const fixo = FIXOS.includes(def.to)
    return {
      def,
      visible: fixo ? true : (porRota.get(def.to) ?? true),
      podeEsconder: !fixo,
    }
  })
}

/** As rotas escondidas, para quem só precisa perguntar "esse está fora?". */
export function escondidos<T extends { to: string }>(
  itens: ReadonlyArray<ModuloDaLista<T>>,
): Set<string> {
  return new Set(itens.filter((item) => !item.visible).map((item) => item.def.to))
}

/**
 * Se um widget do painel continua fazendo sentido.
 *
 * O widget cita os módulos de onde vem o dado e só sai quando *todos* estão
 * escondidos: "Estudos" mostra faculdade e cursos juntos, e esconder um lado
 * não deveria apagar o outro. Widget sem módulo declarado nunca sai.
 */
export function moduloAtivo(modulos: readonly string[], fora: ReadonlySet<string>): boolean {
  if (modulos.length === 0) return true
  return modulos.some((modulo) => !fora.has(modulo))
}
