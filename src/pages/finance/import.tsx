import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/misc'
import { ExportCard } from '@/features/finance/export-card'
import { ImportColumns } from '@/features/finance/import-columns'
import { ImportDone } from '@/features/finance/import-done'
import { ImportFilePicker } from '@/features/finance/import-file-picker'
import { ImportPreview } from '@/features/finance/import-preview'
import { ImportAccounts, ImportCategories } from '@/features/finance/import-targets'
import { ResetFinanceCard } from '@/features/finance/reset-card'
import { useImportWizard } from '@/features/finance/use-import-wizard'
import type { ImportProgress } from '@/features/finance/use-import'

export function ImportPage() {
  const navigate = useNavigate()
  const wizard = useImportWizard()

  if (wizard.result) {
    return (
      <ImportDone
        result={wizard.result}
        onAgain={wizard.reset}
        onSeeAll={() => navigate('/financeiro/transacoes')}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/financeiro/transacoes" className="text-fg-subtle hover:text-fg">
              <ArrowLeft className="size-4" />
            </Link>
            <h1 className="text-fg text-xl font-semibold">Planilhas</h1>
          </div>
          <p className="text-fg-muted mt-1 max-w-2xl text-sm">
            Traga o extrato exportado de outro app em vez de redigitar, ou leve os seus lançamentos
            para fora. Tudo acontece no seu navegador — nada é enviado para lugar nenhum — e nada é
            gravado até você conferir a prévia.
          </p>
        </div>
        {wizard.fileName && (
          <Button variant="secondary" onClick={wizard.reset}>
            Trocar arquivo
          </Button>
        )}
      </div>

      {!wizard.fileName ? (
        <>
          <ExportCard />
          <ImportFilePicker onPick={(file) => void wizard.loadFile(file)} error={wizard.readError} />
          <ResetFinanceCard />
        </>
      ) : (
        <>
          <ImportColumns
            fileName={wizard.fileName}
            header={wizard.header}
            dataRows={wizard.dataRows}
            map={wizard.map}
            onChange={wizard.setMap}
          />

          {wizard.rows.length > 0 && (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <ImportAccounts
                  labels={wizard.accountLabels}
                  accounts={wizard.accounts}
                  choice={wizard.accountChoice}
                  onChoose={wizard.chooseAccount}
                  fallbackAccount={wizard.fallbackAccount}
                  onFallbackChange={wizard.setFallbackAccount}
                />
                <ImportCategories
                  labels={wizard.categoryLabels}
                  categories={wizard.categories}
                  choice={wizard.categoryChoice}
                  onChoose={wizard.chooseCategory}
                />
              </div>

              <ImportPreview
                rows={wizard.rows}
                summary={wizard.summary}
                filter={wizard.filter}
                onFilterChange={wizard.setFilter}
                selected={wizard.selected}
                onToggle={wizard.toggle}
              />

              {wizard.running && wizard.progress && wizard.progress.total > 0 && (
                <WritingCard progress={wizard.progress} />
              )}

              <div className="flex flex-wrap items-center justify-end gap-3">
                <p className="text-fg-subtle mr-auto text-xs">
                  {wizard.summary.ready} de {wizard.rows.length} linhas serão gravadas.
                </p>
                <Button variant="secondary" onClick={wizard.reset}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => void wizard.importNow()}
                  disabled={wizard.summary.ready === 0 || wizard.running}
                >
                  {wizard.running ? <Loader2 className="animate-spin" /> : <Check />}
                  {botao(wizard.running, wizard.progress, wizard.summary.ready)}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function botao(running: boolean, progress: ImportProgress | null, ready: number): string {
  if (!running) return `Importar ${ready}`
  if (progress && progress.total > 0) return `Gravando ${progress.done} de ${progress.total}`
  return 'Importando…'
}

function WritingCard({ progress }: { progress: ImportProgress }) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="text-fg-muted flex items-center justify-between text-xs">
          <span>Gravando lançamentos…</span>
          <span className="tabular-nums">
            {progress.done} de {progress.total}
          </span>
        </div>
        <Progress value={progress.done} max={progress.total} />
        <p className="text-fg-subtle text-[11px]">
          Não feche a janela: o que já foi gravado permanece, mas o resto não entra.
        </p>
      </CardContent>
    </Card>
  )
}
