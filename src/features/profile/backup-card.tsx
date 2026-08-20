import { Cloud, CloudOff, Download, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/misc'
import { Modal } from '@/components/ui/modal'
import { BACKUP_TABLES, exportAll, importAll } from '@/data/queries'
import {
  backupCounts,
  backupFilename,
  buildBackup,
  parseBackup,
  splitKnownTables,
  totalRows,
  type BackupFile,
} from '@/lib/backup/backup'
import { today } from '@/lib/dates'
import { isCloudEnabled } from '@/lib/supabase'
import { integer, longDate } from '@/lib/format'

/** Data do último backup, só para lembrar quanto tempo faz. */
const LAST_BACKUP_KEY = 'life:last-backup'

export function BackupCard() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ file: BackupFile; unknown: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [lastBackup, setLastBackup] = useState(() => localStorage.getItem(LAST_BACKUP_KEY))

  async function handleExport() {
    setBusy(true)
    setError(null)
    try {
      const tables = await exportAll()
      const file = buildBackup(tables, new Date().toISOString())
      download(backupFilename(today()), JSON.stringify(file, null, 2))

      localStorage.setItem(LAST_BACKUP_KEY, today())
      setLastBackup(today())
      setStatus(`Backup gerado com ${integer(totalRows(file))} registros.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível gerar o backup.')
    } finally {
      setBusy(false)
    }
  }

  async function handleFile(file: File) {
    setError(null)
    setStatus(null)
    try {
      const result = parseBackup(JSON.parse(await file.text()))
      if (!result.ok) {
        setError(result.error)
        return
      }
      const split = splitKnownTables(result.file, BACKUP_TABLES)
      setPending({ file: { ...result.file, tables: split.known }, unknown: split.unknown })
    } catch {
      setError('O arquivo não é um JSON válido.')
    }
  }

  async function confirmImport() {
    if (!pending) return
    setBusy(true)
    try {
      await importAll(pending.file.tables)
      // Recarrega em vez de invalidar as queries uma a uma: depois de trocar o
      // conteúdo de vinte tabelas, partir de um estado limpo é mais confiável
      // do que remendar o cache.
      location.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível restaurar o backup.')
      setBusy(false)
      setPending(null)
    }
  }

  function resetData() {
    if (!confirm('Isso apaga todos os dados locais deste navegador. Continuar?')) return
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index)
      if (key?.startsWith('life:table:')) localStorage.removeItem(key)
    }
    location.reload()
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-fg text-sm font-medium">
              {isCloudEnabled ? 'Conectado ao Supabase' : 'Rodando em modo local'}
            </p>
            <p className="text-fg-muted mt-1 text-xs">
              {isCloudEnabled
                ? 'Os registros vão para o Postgres e são protegidos por RLS.'
                : 'Os registros ficam neste navegador, nesta máquina. Formatar o computador ou limpar os dados do site apaga tudo — o backup é o que sobrevive.'}
            </p>
          </div>
          <Badge tone={isCloudEnabled ? 'positive' : 'neutral'}>
            {isCloudEnabled ? <Cloud className="size-3" /> : <CloudOff className="size-3" />}
            {isCloudEnabled ? 'Supabase' : 'Local'}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void handleExport()}>
            <Download />
            Exportar backup
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <Upload />
            Restaurar backup
          </Button>
          <Button variant="ghost" size="sm" onClick={resetData}>
            <Trash2 />
            Apagar dados locais
          </Button>

          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              // Zera o valor para escolher o mesmo arquivo duas vezes seguidas
              // continuar disparando o evento.
              event.target.value = ''
              if (file) void handleFile(file)
            }}
          />
        </div>

        <p className="text-fg-subtle text-[11px]">
          {lastBackup
            ? `Último backup em ${longDate(lastBackup)}.`
            : 'Nenhum backup gerado ainda neste navegador.'}{' '}
          O arquivo é um JSON legível, com todas as tabelas — guarde no Drive, no e-mail ou onde
          preferir.
        </p>

        {status && (
          <p className="text-positive bg-positive/10 rounded-lg px-3 py-2 text-xs font-medium">
            {status}
          </p>
        )}
        {error && (
          <p className="text-negative bg-negative/10 rounded-lg px-3 py-2 text-xs font-medium">
            {error}
          </p>
        )}
      </CardContent>

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Restaurar backup"
        description="Confira o conteúdo antes de substituir o que está gravado."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => void confirmImport()}>
              {busy ? 'Restaurando…' : 'Substituir meus dados'}
            </Button>
          </>
        }
      >
        {pending && (
          <div className="space-y-4">
            <p className="text-fg-muted text-sm">
              Isto deixa o app <strong className="text-fg">igual ao arquivo</strong>: o que está no
              backup entra, e o que existe hoje e não está lá é removido. Não dá para desfazer —
              se tiver dúvida, exporte um backup do estado atual antes.
            </p>

            {pending.file.exported_at && (
              <p className="text-fg-subtle text-xs">
                Backup gerado em {longDate(pending.file.exported_at.slice(0, 10))}.
              </p>
            )}

            <div className="border-border-base divide-border-base divide-y rounded-lg border">
              {backupCounts(pending.file).map((entry) => (
                <div
                  key={entry.table}
                  className="flex items-baseline justify-between gap-4 px-3 py-1.5 text-xs"
                >
                  <span className="text-fg-muted">{TABLE_LABELS[entry.table] ?? entry.table}</span>
                  <span className="text-fg font-medium">{integer(entry.count)}</span>
                </div>
              ))}
              {backupCounts(pending.file).length === 0 && (
                <p className="text-fg-muted px-3 py-2 text-xs">
                  O backup não tem nenhum registro — restaurar vai esvaziar o app.
                </p>
              )}
            </div>

            {pending.unknown.length > 0 && (
              <p className="text-warning bg-warning/10 rounded-lg px-3 py-2 text-xs">
                Estas tabelas vieram no arquivo mas esta versão do app não conhece, então ficarão
                de fora: {pending.unknown.join(', ')}.
              </p>
            )}
          </div>
        )}
      </Modal>
    </Card>
  )
}

/** Nome de tabela é detalhe do banco; na tela vale o nome da coisa. */
const TABLE_LABELS: Record<string, string> = {
  profiles: 'Perfil',
  activity_types: 'Atividades',
  workout_sessions: 'Treinos',
  body_measurements: 'Medidas',
  health_metrics_daily: 'Métricas diárias',
  diet_plans: 'Planos de emagrecimento',
  foods: 'Alimentos',
  meal_logs: 'Diário alimentar',
  institutions: 'Instituições',
  programs: 'Cursos',
  subjects: 'Disciplinas',
  assessments: 'Avaliações',
  course_lessons: 'Aulas',
  notes: 'Anotações',
  deadlines: 'Compromissos',
  accounts: 'Contas e cartões',
  categories: 'Categorias',
  transactions: 'Lançamentos',
  budgets: 'Orçamentos',
  financial_goals: 'Metas',
  recurring_transactions: 'Recorrentes',
  habits: 'Hábitos',
  habit_logs: 'Registros de hábito',
  dashboard_widgets: 'Layout do dashboard',
}

function download(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
