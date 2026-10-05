import { Download, Info } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { useAccounts, useCategories, useTransactions } from '@/data/queries'
import { toCompetence } from '@/lib/finance/billing'
import { cycleOf } from '@/lib/finance/reports'
import {
  buildExportRows,
  exportFilename,
  filtrarPorPeriodo,
  periodoDeTudo,
  periodoValido,
  toCsvFile,
  type Periodo,
} from '@/lib/finance/export'
import { integer } from '@/lib/format'
import { PLANILHA_CSV, salvarArquivo } from '@/lib/salvar-arquivo'
import { today } from '@/lib/utils'

/**
 * Exportação dos lançamentos.
 *
 * Fica ao lado da importação de propósito: são a mesma porta, em sentidos
 * opostos, e o arquivo que sai daqui é exatamente o que aquela sabe ler de
 * volta.
 *
 * O recorte é um intervalo de meses em vez de uma lista de opções. A lista
 * cobria três pedidos e deixava de fora o trimestre, o semestre e o ano
 * fechado, que são justamente os recortes que alguém exporta para levar
 * adiante.
 */
export function ExportCard() {
  const { data: transactions } = useTransactions()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()

  // Nulo enquanto ninguém mexeu: o intervalo acompanha os lançamentos que
  // forem chegando, em vez de travar no que existia na primeira renderização.
  const [escolhido, setEscolhido] = useState<Periodo | null>(null)
  const [busy, setBusy] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const tudo = useMemo(() => periodoDeTudo(transactions, toCompetence(today())), [transactions])
  const periodo = escolhido ?? tudo
  const valido = periodoValido(periodo)

  const selecionadas = useMemo(
    () => filtrarPorPeriodo(transactions, periodo),
    [transactions, periodo],
  )

  const transferencias = selecionadas.filter((tx) => tx.kind === 'transfer').length
  const recortado = periodo.de !== tudo.de || periodo.ate !== tudo.ate
  const aberto = !periodo.de || !periodo.ate

  /**
   * Mexer no período apaga o recibo do download anterior.
   *
   * Ele diz quantos lançamentos saíram, e trocando o mês aquele número passa a
   * contradizer o do botão ao lado — "7 lançamentos exportados" embaixo de
   * "Baixar 1".
   */
  function trocarPeriodo(novo: Periodo | null) {
    setEscolhido(novo)
    setAviso(null)
  }

  async function exportar() {
    setBusy(true)
    setAviso(null)
    try {
      const accountName = new Map(accounts.map((a) => [a.id, a.name]))
      const categoryName = new Map(categories.map((c) => [c.id, c.name]))

      const csv = toCsvFile(
        buildExportRows(selecionadas, {
          account: (id) => accountName.get(id) ?? '',
          category: (id) => (id ? (categoryName.get(id) ?? '') : ''),
          cartao: (id) => {
            const conta = accounts.find((a) => a.id === id)
            return conta?.kind === 'credit' ? cycleOf(conta) : null
          },
        }),
      )

      const salvo = await salvarArquivo(exportFilename(periodo, today()), csv, PLANILHA_CSV)
      if (salvo) setAviso(`${integer(selecionadas.length)} lançamentos exportados.`)
    } catch (causa) {
      setAviso(causa instanceof Error ? causa.message : 'Não foi possível gerar o arquivo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Exportar lançamentos"
        description="Um CSV que abre no Excel — e que esta mesma tela sabe importar de volta. O recorte é pelo mês do lançamento, data por data — a compra no cartão sai no mês em que foi feita."
      />
      <CardContent className="space-y-4">
        {/*
          Alinhado pela base: os campos têm a mesma altura — sem dica embaixo,
          que só repetiria o mês que o próprio campo já escreve por extenso — e
          assim os botões encostam na linha dos inputs sem margem chutada.
        */}
        <div className="flex flex-wrap items-end gap-3">
          <Field label="De" className="min-w-36 flex-1 sm:max-w-52">
            <Input
              type="month"
              value={periodo.de}
              onChange={(e) => trocarPeriodo({ ...periodo, de: e.target.value })}
            />
          </Field>

          <Field label="Até" className="min-w-36 flex-1 sm:max-w-52">
            <Input
              type="month"
              value={periodo.ate}
              onChange={(e) => trocarPeriodo({ ...periodo, ate: e.target.value })}
            />
          </Field>

          <div className="flex items-center gap-2">
            {recortado && (
              <Button variant="ghost" onClick={() => trocarPeriodo(null)}>
                Tudo
              </Button>
            )}
            <Button
              onClick={() => void exportar()}
              disabled={busy || !valido || selecionadas.length === 0}
            >
              <Download />
              {busy ? 'Gerando…' : `Baixar ${integer(selecionadas.length)}`}
            </Button>
          </div>
        </div>

        {aberto && valido && (
          <p className="text-fg-subtle text-xs">
            {periodo.de
              ? 'Sem o mês final, o arquivo vai até o último lançamento.'
              : 'Sem o mês inicial, o arquivo começa no primeiro lançamento.'}
          </p>
        )}

        {!valido ? (
          <p className="text-negative text-xs">O mês final vem antes do inicial.</p>
        ) : selecionadas.length === 0 ? (
          <p className="text-fg-muted text-xs">Nenhum lançamento neste recorte.</p>
        ) : (
          <p className="text-fg-subtle flex items-start gap-1.5 text-xs leading-relaxed">
            <Info className="mt-0.5 size-3 shrink-0" />
            <span>
              Colunas: data, valor, tipo, descrição, complemento, conta, destino, categoria,
              situação e fatura (em qual fatura do cartão a compra caiu). Separado por ponto e
              vírgula, que é o que o Excel em português espera.
              {transferencias > 0 && (
                <>
                  {' '}
                  <strong className="text-fg-muted">
                    {integer(transferencias)}{' '}
                    {transferencias === 1 ? 'transferência entra' : 'transferências entram'} no
                    arquivo
                  </strong>{' '}
                  para o extrato fechar com o saldo. A coluna destino guarda a conta que recebeu,
                  então elas voltam inteiras se você reimportar este mesmo arquivo.
                </>
              )}
            </span>
          </p>
        )}

        {aviso && <p className="text-fg-muted text-xs font-medium">{aviso}</p>}
      </CardContent>
    </Card>
  )
}
