/**
 * Agenda unificada.
 *
 * O calendário só vira algo útil quando mostra tudo junto: a prova de terça, o
 * treino de quarta, a fatura que vence quinta. Separado por módulo, cada um
 * deles já existe em outra tela — o valor está na sobreposição, que é onde os
 * conflitos aparecem.
 *
 * Tudo aqui é função pura sobre listas já filtradas. Cada origem tem o seu
 * construtor, e quem monta a agenda só junta e ordena — assim dá para testar
 * cada regra isoladamente e acrescentar uma origem nova sem tocar nas outras.
 *
 * Este arquivo é a porta: as regras moram em `agenda/`, uma por área da vida,
 * e quem consome a agenda continua importando daqui.
 */

export * from './agenda/tipos'
export * from './agenda/educacao'
export * from './agenda/rotina'
export * from './agenda/saude'
export * from './agenda/financeiro'
export * from './agenda/consultas'
