import { open } from '@tauri-apps/plugin-dialog'
import { AlertTriangle, FolderOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Select } from '@/components/ui/field'
import { Callout, Toggle } from '@/components/ui/misc'
import {
  EVENTO_BACKUP,
  backupAutomaticoDisponivel,
  executarBackupAutomatico,
  gravarConfigDoBackup,
  lerConfigDoBackup,
  type ConfigDoBackup,
} from '@/data/backup-automatico'
import { OPCOES_DE_COPIAS } from '@/lib/backup/automatico'
import { longDate } from '@/lib/format'
import { today } from '@/lib/utils'

/**
 * Liga o backup diário e escolhe onde ele fica.
 *
 * Ligar abre o seletor de pasta na hora: um backup ligado sem destino seria um
 * interruptor que não faz nada, e a pessoa só descobriria no dia em que
 * precisasse da cópia.
 */
export function BackupAutomaticoCard() {
  const [config, setConfig] = useState(lerConfigDoBackup)
  const [fazendo, setFazendo] = useState(false)

  // O vigia grava o resultado em segundo plano; o cartão acompanha.
  useEffect(() => {
    const aoMudar = () => setConfig(lerConfigDoBackup())
    window.addEventListener(EVENTO_BACKUP, aoMudar)
    return () => window.removeEventListener(EVENTO_BACKUP, aoMudar)
  }, [])

  if (!backupAutomaticoDisponivel()) {
    return (
      <Card>
        <CardHeader
          title="Backup automático"
          description="No programa instalado, o Life guarda sozinho uma cópia por dia numa pasta sua. Aqui no navegador, use o Exportar backup logo abaixo."
        />
      </Card>
    )
  }

  function salvar(proxima: ConfigDoBackup) {
    setConfig(proxima)
    gravarConfigDoBackup(proxima)
  }

  async function escolherPasta(): Promise<string | null> {
    const escolhida = await open({ directory: true, multiple: false, title: 'Pasta dos backups' })
    return typeof escolhida === 'string' ? escolhida : null
  }

  async function ligar(ligado: boolean) {
    if (!ligado) {
      salvar({ ...config, pasta: null, erro: null })
      return
    }
    const pasta = await escolherPasta()
    // Pasta nova: a cópia de hoje ainda não está nela, mesmo que outra pasta já
    // tenha recebido uma.
    if (pasta) salvar({ ...config, pasta, ultimo: null, erro: null })
  }

  async function trocarPasta() {
    const pasta = await escolherPasta()
    if (pasta) salvar({ ...config, pasta, ultimo: null, erro: null })
  }

  async function fazerAgora() {
    setFazendo(true)
    try {
      setConfig(await executarBackupAutomatico(today()))
    } finally {
      setFazendo(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Backup automático"
        description="Uma cópia por dia, numa pasta sua, sem precisar lembrar. As mais antigas saem sozinhas."
        action={
          <Toggle
            checked={config.pasta !== null}
            label="Fazer backup automático"
            onChange={(ligado) => void ligar(ligado)}
          />
        }
      />
      {config.pasta && (
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="text-fg-subtle size-4 shrink-0" />
            <p className="text-fg min-w-0 flex-1 truncate text-sm" title={config.pasta}>
              {config.pasta}
            </p>
            <Button variant="ghost" size="sm" onClick={() => void trocarPasta()}>
              Trocar
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-fg-muted flex items-center gap-2 text-xs">
              Guardar
              <Select
                value={String(config.manter)}
                onChange={(e) => salvar({ ...config, manter: Number(e.target.value) })}
                className="w-auto"
                aria-label="Quantas cópias guardar"
              >
                {OPCOES_DE_COPIAS.map((opcao) => (
                  <option key={opcao} value={opcao}>
                    {opcao} dias
                  </option>
                ))}
              </Select>
            </label>
            <Button
              variant="secondary"
              size="sm"
              disabled={fazendo}
              onClick={() => void fazerAgora()}
            >
              {fazendo ? 'Gravando…' : 'Fazer agora'}
            </Button>
          </div>

          {config.erro ? (
            <Callout tone="negative" icon={<AlertTriangle className="size-3.5" />}>
              O último backup falhou: {config.erro} O Life tenta de novo em uma hora.
            </Callout>
          ) : (
            <p className="text-fg-subtle text-xs">
              {config.ultimo
                ? `Último backup em ${longDate(config.ultimo)}.`
                : 'O primeiro backup sai em instantes.'}{' '}
              Os arquivos se chamam life-auto-AAAA-MM-DD.json e se restauram pelo Restaurar
              backup.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  )
}
