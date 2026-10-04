/**
 * Regras do backup automático: quando fazer, como chamar o arquivo e quais
 * cópias velhas apagar.
 *
 * O backup manual depende de alguém lembrar, e quem lembra de fazer backup é
 * quem acabou de perder dados. Este roda sozinho, uma vez por dia, enquanto os
 * dados ainda vivem só nesta máquina.
 */

/** Prefixo próprio: a limpeza nunca pode alcançar um backup feito à mão na mesma pasta. */
const PREFIXO = 'life-auto-'
const PADRAO_DO_NOME = /^life-auto-(\d{4}-\d{2}-\d{2})\.json$/

export const OPCOES_DE_COPIAS = [7, 14, 30] as const
export const COPIAS_PADRAO = 14

export function nomeDoBackupAutomatico(hoje: string): string {
  return `${PREFIXO}${hoje}.json`
}

/** O dia de um backup automático, ou `null` se o arquivo não é um. */
export function diaDoBackup(nome: string): string | null {
  return PADRAO_DO_NOME.exec(nome)?.[1] ?? null
}

/** Um por dia: o de hoje já feito basta, mesmo que o app abra de novo à tarde. */
export function precisaDeBackup(ultimo: string | null, hoje: string): boolean {
  return ultimo !== hoje
}

/**
 * Quais cópias apagar para ficar com as `manter` mais novas.
 *
 * Só olha o que tem o nome do backup automático. Qualquer outro arquivo na
 * pasta, inclusive um `life-backup-*.json` exportado à mão, fica onde está.
 */
export function backupsParaApagar(nomes: string[], manter: number): string[] {
  return nomes
    .filter((nome) => diaDoBackup(nome) !== null)
    .sort((a, b) => b.localeCompare(a))
    .slice(Math.max(manter, 1))
}
