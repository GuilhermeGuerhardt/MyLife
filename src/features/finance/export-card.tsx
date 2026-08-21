import { Download, Info } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, Select } from '@/components/ui/field'
import { useAccounts, useCategories, useTransactions } from '@/data/queries'
import { addMonths, competenceLabel, toCompetence } from '@/lib/finance/billing'
import {
  buildExportRows,
  exportFilename,
  filterByScope,
  SCOPE_LABELS,
  toCsvFile,
  type ExportScope,
} from '@/lib/finance/export'
import { integer } from '@/lib/format'
import { PLANILHA_CSV, salvarArquivo } from '@/lib/salvar-arquivo'
import { today } from '@/lib/utils'

const SCOPES = Object.keys(SCOPE_LABELS) as ExportScope[]

/**
 * Exportação dos lançamentos.
 *
 * Fica ao lado da importação de propósito: são a mesma porta, em sentidos
 * opostos, e o arquivo que sai daqui é exatamente o que aquela sabe ler de
 * volta.
 */
export function ExportCard() {
  const { data: transactions } = useTransactions()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()

  const [scope, setScope] = useState<ExportScope>('all')
  const [busy, setBusy] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const competence = toCompetence(today())

  const selecionadas = useMemo(
    () => filterByScope(transactions, scope, competence, addMonths),
    [transactions, scope, competence],
  )

  const transferencias = selecionadas.filter((tx) => tx.kind === 'transfer').length

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
        }),
      )

      const salvo = await salvarArquivo(
        exportFilename(scope, competence, today()),
        csv,
        PLANILHA_CSV,
      )
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
        description="Um CSV que abre no Excel — e que esta mesma tela sabe importar de volta."
      />
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="O que exportar" className="min-w-48 flex-1">
            <Select value={scope} onChange={(e) => setScope(e.target.value as ExportScope)}>
              {SCOPES.map((option) => (
                <option key={option} value={option}>
                  {SCOPE_LABELS[option]}
                  {option === 'month' ? ` · ${competenceLabel(competence)}` : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Button
            onClick={() => void exportar()}
            disabled={busy || selecionadas.length === 0}
          >
            <Download />
            {busy ? 'Gerando…' : `Baixar ${integer(selecionadas.length)}`}
          </Button>
        </div>

        {selecionadas.length === 0 ? (
          <p className="text-fg-muted text-xs">Nenhum lançamento neste recorte.</p>
        ) : (
          <p className="text-fg-subtle flex items-start gap-1.5 text-[11px] leading-relaxed">
            <Info className="mt-0.5 size-3 shrink-0" />
            <span>
              Colunas: data, valor, tipo, descrição, complemento, conta, categoria e situação.
              Separado por ponto e vírgula, que é o que o Excel em português espera.
              {transferencias > 0 && (
                <>
                  {' '}
                  <strong className="text-fg-muted">
                    {integer(transferencias)}{' '}
                    {transferencias === 1 ? 'transferência entra' : 'transferências entram'} no
                    arquivo
                  </strong>{' '}
                  para o extrato fechar com o saldo. Reimportadas, porém, voltam como despesa — a
                  planilha não tem onde guardar a conta de destino — e, por mudarem de tipo, não
                  são reconhecidas como repetidas. Desmarque-as se reimportar este mesmo arquivo.
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
