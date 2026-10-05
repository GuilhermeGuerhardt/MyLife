import { AlertTriangle, Check, Clock, CreditCard, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { CaixaDeSelecao } from '@/components/ui/caixa-de-selecao'
import { Toast, ToastArea } from '@/components/ui/toast'
import { LoteRecusado, useAccounts } from '@/data/queries'
import { confirmar } from '@/lib/avisos'
import { formatCents } from '@/lib/finance/money'
import {
  resumoDaSelecao,
  separarParaPagamento,
  voltamParaAFatura,
  type ResumoDaSelecao,
} from '@/lib/finance/selecao'
import { cn } from '@/lib/utils'
import { useRemoveTransactions, useSetTransactionsPaid } from './actions'
import type { Selecao } from './use-selecao'

function contar(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

function juntar(itens: string[]): string {
  return itens.length <= 1 ? (itens[0] ?? '') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`
}

interface Parte {
  rotulo: string
  /** `null` = só contado, sem valor ao lado. */
  cents: number | null
}

/** O que a seleção tem, um tipo por vez, na ordem em que a tela lê. */
function partesDoResumo({ despesas, receitas, transferencias }: ResumoDaSelecao): Parte[] {
  const partes: Parte[] = []
  if (despesas.quantidade > 0) {
    partes.push({ rotulo: contar(despesas.quantidade, 'despesa', 'despesas'), cents: despesas.cents })
  }
  if (receitas.quantidade > 0) {
    partes.push({ rotulo: contar(receitas.quantidade, 'receita', 'receitas'), cents: receitas.cents })
  }
  if (transferencias.quantidade > 0) {
    partes.push({
      rotulo: contar(transferencias.quantidade, 'transferência', 'transferências'),
      // Ao lado de receita e despesa, o valor da transferência parecia parte
      // da soma. Sozinha, ela é o próprio total que a pessoa quer ver.
      cents: partes.length === 0 ? transferencias.cents : null,
    })
  }
  return partes
}

/** Saldo só quando há os dois lados: com um só, ele repete o número que já está escrito, com sinal. */
function temSaldo({ despesas, receitas }: ResumoDaSelecao): boolean {
  return despesas.quantidade > 0 && receitas.quantidade > 0
}

function textoDoSaldo(cents: number): string {
  return `${cents < 0 ? '−' : '+'}${formatCents(Math.abs(cents))}`
}

/**
 * O resumo numa linha de texto: é o que o leitor de tela anuncia e o que a
 * dica mostra quando a linha da barra não comporta tudo.
 */
function textoDoResumo(resumo: ResumoDaSelecao): string {
  const partes = partesDoResumo(resumo)
  const [unica] = partes
  if (partes.length === 1 && unica) {
    return unica.cents === null ? unica.rotulo : `${unica.rotulo} · ${formatCents(unica.cents)}`
  }
  return [
    contar(resumo.quantidade, 'selecionado', 'selecionados'),
    temSaldo(resumo) ? `saldo ${textoDoSaldo(resumo.saldoCents)}` : null,
    ...partes.map((p) => (p.cents === null ? p.rotulo : `${p.rotulo} ${formatCents(p.cents)}`)),
  ]
    .filter(Boolean)
    .join(' · ')
}

function avisoDasParcelas({ parcelas, quantidade }: ResumoDaSelecao): string | null {
  if (parcelas === 0) return null
  if (quantidade === 1) return 'É uma parcela: só ela é apagada, as outras parcelas da compra continuam.'
  if (parcelas === 1) return 'Um deles é parcela: só ela é apagada, as outras parcelas da compra continuam.'
  return `${parcelas} deles são parcelas: só elas são apagadas, as outras parcelas de cada compra continuam.`
}

/**
 * A pergunta antes de apagar diz o que vai embora — quantos e quanto —, porque
 * "tem certeza?" sozinho não deixa conferir se a seleção é a que se queria.
 */
function mensagemDeApagar(resumo: ResumoDaSelecao): string {
  const partes = partesDoResumo(resumo).map((parte) =>
    parte.cents === null ? parte.rotulo : `${parte.rotulo} (${formatCents(parte.cents)})`,
  )
  const oQue =
    partes.length === 1
      ? partes[0]
      : `${contar(resumo.quantidade, 'lançamento', 'lançamentos')}: ${juntar(partes)}`
  return [`Apagar ${oQue}?`, 'Isso não tem volta.', avisoDasParcelas(resumo)]
    .filter(Boolean)
    .join('\n\n')
}

function mensagemDeReabrir(compras: number): string {
  const uma = compras === 1
  return [
    `${uma ? 'Uma compra no cartão volta' : `${compras} compras no cartão voltam`} para a fatura em aberto.`,
    `Depois, nem a linha nem a seleção conseguem ${uma ? 'marcá-la como paga' : 'marcá-las como pagas'} de novo: no cartão, quem faz isso é a quitação da fatura.`,
  ].join('\n\n')
}

interface Aviso {
  /** Muda a cada aviso: o `Toast` remonta e o prazo para sumir recomeça do zero. */
  id: number
  tipo: 'cartao' | 'falha'
  titulo: string
  texto: string
  motivo?: string
}

/** Como cada ação se descreve quando não termina. */
interface Verbo {
  nada: string
}

const VERBO_PAGO: Verbo = { nada: 'Nada foi marcado como pago' }
const VERBO_NAO_PAGO: Verbo = { nada: 'Nada foi marcado como não pago' }
const VERBO_APAGAR: Verbo = { nada: 'Nada foi apagado' }

/**
 * O que dizer quando a gravação falha.
 *
 * O lote é tudo ou nada, então não existe "parou no meio": ou tudo foi, ou
 * nada foi, e a seleção continua para tentar de novo.
 */
function avisoDeFalha(erro: unknown, verbo: Verbo): Omit<Aviso, 'id'> {
  const causa = erro instanceof LoteRecusado ? erro.cause : erro
  const motivo = causa instanceof Error ? causa.message : undefined
  return {
    tipo: 'falha',
    titulo: verbo.nada,
    texto: 'A seleção continua marcada para tentar de novo.',
    motivo,
  }
}

function Valor({ cents, saldo = false }: { cents: number; saldo?: boolean }) {
  // O saldo segue a regra do `Stat`: número neutro, vermelho só quando falta.
  return (
    <span
      className={cn(
        'font-serif text-sm font-semibold whitespace-nowrap',
        saldo && cents < 0 ? 'text-negative' : 'text-fg',
      )}
    >
      {saldo ? textoDoSaldo(cents) : formatCents(cents)}
    </span>
  )
}

function Separador() {
  return (
    <span aria-hidden className="text-fg-subtle">
      ·
    </span>
  )
}

/**
 * Um pedaço do resumo. É um bloco inteiro de propósito: quando a linha não
 * comporta tudo, o pedaço que sobra some inteiro atrás das reticências, em vez
 * de cortar um valor ao meio.
 */
function Trecho({ primeiro = false, children }: { primeiro?: boolean; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-baseline gap-1.5', !primeiro && 'ml-1.5')}>
      {children}
    </span>
  )
}

/**
 * O resumo à vista, sempre numa linha. O que não cabe vira reticências, com o
 * texto inteiro na dica — quebrar a linha fazia a barra crescer e a lista
 * descer no meio dos cliques.
 *
 * Seleção mista abre com o saldo, logo depois da contagem: se a linha cortar,
 * corta o detalhe e o número que resume tudo fica.
 */
function Resumo({ resumo }: { resumo: ResumoDaSelecao }) {
  const partes = partesDoResumo(resumo)
  const [unica] = partes

  return (
    // Escondido do leitor de tela porque o mesmo texto já está na região de
    // status da barra; sem isso ele seria lido duas vezes.
    <p
      aria-hidden
      title={textoDoResumo(resumo)}
      className="text-fg-muted min-w-0 flex-1 truncate text-xs"
    >
      {partes.length === 1 && unica ? (
        <Trecho primeiro>
          <span className="text-fg font-medium">{unica.rotulo}</span>
          {unica.cents !== null && (
            <>
              <Separador />
              <Valor cents={unica.cents} />
            </>
          )}
        </Trecho>
      ) : (
        <>
          <Trecho primeiro>
            <span className="text-fg font-medium">
              {contar(resumo.quantidade, 'selecionado', 'selecionados')}
            </span>
          </Trecho>
          {temSaldo(resumo) && (
            <Trecho>
              <Separador />
              saldo
              <Valor cents={resumo.saldoCents} saldo />
            </Trecho>
          )}
          {partes.map((parte) => (
            <Trecho key={parte.rotulo}>
              <Separador />
              {parte.rotulo}
              {parte.cents !== null && <Valor cents={parte.cents} />}
            </Trecho>
          ))}
        </>
      )}
    </p>
  )
}

/**
 * O topo da lista de lançamentos: marcar todos, ver quanto o marcado soma e
 * agir sobre ele de uma vez.
 *
 * Sem nada marcado ela é só a caixa e uma palavra. Com marcação, gruda no topo
 * enquanto a lista rola — quem marca o quinto item lá embaixo precisa ver o
 * total e os botões sem voltar para cima.
 *
 * A altura é a mesma nos dois estados, em qualquer largura: se a barra
 * crescesse ao marcar o primeiro, a lista inteira descia debaixo do cursor e o
 * segundo clique caía na linha errada — no celular, abria o editor de outro
 * lançamento. Por isso o resumo não quebra linha e, no celular, as ações saem
 * da barra para uma faixa presa acima da navegação de baixo.
 */
export function BarraDeSelecao({ selecao }: { selecao: Selecao }) {
  const { data: contas } = useAccounts()
  const setPaidMany = useSetTransactionsPaid()
  const removeTransactions = useRemoveTransactions()
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const ultimoAviso = useRef(0)
  // Estável de propósito: o aviso reinicia a contagem para sumir sempre que o
  // `onClose` muda, e a barra renderiza a cada caixa marcada.
  const fecharAviso = useCallback(() => setAviso(null), [])
  const caixaDeTodos = useRef<HTMLInputElement>(null)

  const contaPorId = useMemo(() => new Map(contas.map((c) => [c.id, c])), [contas])
  const { itens, visiveis } = selecao
  const quantos = itens.length
  const todos = quantos > 0 && quantos === visiveis
  const resumo = resumoDaSelecao(itens)
  const paraPagar = separarParaPagamento(itens, contaPorId, true)
  const paraDesfazer = separarParaPagamento(itens, contaPorId, false)

  // Ao esvaziar, os botões da barra desmontam, e o foco que estava num deles
  // cai no <body>: o Tab seguinte recomeçaria do menu lateral. Ele volta para
  // a caixa de cima, que continua ali. Sem rolar: a barra deixa de grudar no
  // topo ao esvaziar, e com o mouse a página pular até ela a cada ação seria
  // pior do que o foco perdido.
  const tinhaSelecao = useRef(false)
  useEffect(() => {
    const tinha = tinhaSelecao.current
    tinhaSelecao.current = quantos > 0
    if (!tinha || quantos > 0) return
    const ativo = document.activeElement
    if (!ativo || ativo === document.body) caixaDeTodos.current?.focus({ preventScroll: true })
  }, [quantos])

  function avisar(novo: Omit<Aviso, 'id'>) {
    ultimoAviso.current += 1
    setAviso({ ...novo, id: ultimoAviso.current })
  }

  // Os botões travam enquanto a ação roda: um segundo clique gravaria tudo de
  // novo, ou perguntaria duas vezes se pode apagar.
  async function executar(acao: () => Promise<void>, verbo: Verbo) {
    setOcupado(true)
    // O aviso da ação anterior não vale para esta.
    setAviso(null)
    try {
      await acao()
    } catch (erro) {
      avisar(avisoDeFalha(erro, verbo))
    } finally {
      setOcupado(false)
    }
  }

  // Cada ação age sobre a seleção do momento do clique e, no fim, desmarca só
  // esses: o que for marcado enquanto ela grava continua marcado.
  async function marcarPago() {
    const alvo = itens
    const { aplicados, ignorados } = await setPaidMany(alvo, true)
    selecao.desmarcar(alvo.map((t) => t.id))
    if (ignorados.length > 0) {
      avisar({
        tipo: 'cartao',
        titulo:
          aplicados > 0
            ? contar(aplicados, 'marcado como pago', 'marcados como pagos')
            : 'Nada foi marcado como pago',
        texto: `${contar(ignorados.length, 'compra no cartão ficou', 'compras no cartão ficaram')} de fora: no cartão, quem paga é a fatura.`,
      })
    }
  }

  async function marcarNaoPago() {
    const alvo = itens
    const reabrem = voltamParaAFatura(paraDesfazer.aplicar, contaPorId)
    if (reabrem.length > 0) {
      const certeza = await confirmar(mensagemDeReabrir(reabrem.length), {
        confirmar: 'Marcar como não pago',
        cancelar: 'Cancelar',
        tom: 'warning',
      })
      if (!certeza) return
    }
    await setPaidMany(alvo, false)
    selecao.desmarcar(alvo.map((t) => t.id))
  }

  async function apagar() {
    const alvo = itens
    const certeza = await confirmar(mensagemDeApagar(resumo), {
      confirmar: 'Apagar',
      cancelar: 'Cancelar',
      tom: 'warning',
    })
    if (!certeza) return
    await removeTransactions(alvo)
    selecao.desmarcar(alvo.map((t) => t.id))
  }

  // O `title` fica num invólucro: botão desabilitado não recebe o ponteiro, e a
  // explicação de por que ele está apagado nunca apareceria.
  const dicaDoPago =
    paraPagar.ignorados.length === 0
      ? paraPagar.aplicar.length === 0
        ? 'Todos já estão pagos'
        : 'Marcar como pago'
      : paraPagar.aplicar.length === 0
        ? 'Compra no cartão em aberto não se marca como paga: quem paga é a fatura'
        : `Marcar como pago — ${contar(paraPagar.ignorados.length, 'compra no cartão fica', 'compras no cartão ficam')} de fora: quem paga é a fatura`
  const dicaDoNaoPago =
    paraDesfazer.aplicar.length === 0 ? 'Nenhum dos marcados está pago' : 'Marcar como não pago'

  return (
    <>
      {visiveis > 0 && (
        <div
          className={cn(
            'border-border-base flex h-11 items-center gap-3 rounded-t-[var(--radius-card)] border-b px-4',
            quantos > 0 && 'bg-surface sticky top-14 z-20',
          )}
        >
          {/* O nome não muda com o estado: "Desmarcar todos, marcada" e, depois
              do clique, "Selecionar todos, não marcada" mais confundia do que
              dizia. O estado já vai no próprio marcado/misto da caixa. */}
          <CaixaDeSelecao
            ref={caixaDeTodos}
            checked={todos}
            indeterminate={quantos > 0 && !todos}
            onChange={selecao.alternarTodos}
            aria-label="Selecionar todos"
          >
            {quantos === 0 && <span className="text-fg-muted text-xs">Selecionar</span>}
          </CaixaDeSelecao>

          {/* Montada desde o começo, vazia: região de status que já nasce com
              texto não é anunciada, e o total da primeira marcação — o caso de
              quem só quer ver a soma — passaria calado. */}
          <span role="status" className="sr-only">
            {quantos > 0 ? textoDoResumo(resumo) : ''}
          </span>

          {quantos > 0 && (
            <>
              <Resumo resumo={resumo} />

              {/* Rótulo curto à vista, frase inteira no nome acessível e na dica:
                  com "Marcar como…" por extenso as ações não cabiam ao lado do
                  resumo.

                  No celular nem assim cabem, e a faixa delas vai para baixo,
                  presa logo acima da navegação (61 px de altura, em
                  `app-shell.tsx`). Fora do fluxo, ela não empurra a lista; e o
                  `pb-24` do conteúdo já reserva o espaço para a última linha
                  não ficar por baixo.

                  O X mora no fim do grupo, nas duas larguras: assim a ordem do
                  Tab é a da tela, e no celular a linha de cima fica inteira
                  para o resumo. */}
              <div
                role="group"
                aria-label="Ações nos selecionados"
                className={cn(
                  'flex shrink-0 items-center gap-1.5',
                  'max-sm:bg-surface/95 max-sm:border-border-base max-sm:fixed max-sm:inset-x-0 max-sm:bottom-[61px] max-sm:justify-center max-sm:border-t max-sm:px-4 max-sm:py-1.5 max-sm:backdrop-blur',
                )}
              >
                <span title={dicaDoPago}>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={ocupado || paraPagar.aplicar.length === 0}
                    onClick={() => void executar(marcarPago, VERBO_PAGO)}
                    aria-label="Marcar como pago"
                  >
                    <Check />
                    Pago
                  </Button>
                </span>
                <span title={dicaDoNaoPago}>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={ocupado || paraDesfazer.aplicar.length === 0}
                    onClick={() => void executar(marcarNaoPago, VERBO_NAO_PAGO)}
                    aria-label="Marcar como não pago"
                  >
                    <Clock />
                    Não pago
                  </Button>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-negative hover:bg-negative/10 hover:text-negative"
                  disabled={ocupado}
                  onClick={() => void executar(apagar, VERBO_APAGAR)}
                >
                  <Trash2 />
                  Apagar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2"
                  disabled={ocupado}
                  onClick={selecao.limpar}
                  aria-label="Limpar seleção"
                  title="Limpar seleção (Esc)"
                >
                  <X />
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {aviso && (
        <ToastArea>
          <Toast
            key={aviso.id}
            icon={
              aviso.tipo === 'falha' ? (
                <AlertTriangle className="size-4" />
              ) : (
                <CreditCard className="size-4" />
              )
            }
            title={aviso.titulo}
            description={
              <>
                {aviso.texto}
                {aviso.motivo && <span className="text-fg-subtle mt-1 block">{aviso.motivo}</span>}
              </>
            }
            duration={aviso.tipo === 'falha' ? null : 6000}
            onClose={fecharAviso}
          />
        </ToastArea>
      )}
    </>
  )
}
