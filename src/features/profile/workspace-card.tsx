import { FolderOpen, FolderSync, Info, Unplug } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/misc'
import { Modal } from '@/components/ui/modal'
import { currentFolder, setFolderStore } from '@/data/adapters'
import {
  forgetFolder,
  hasRememberedFolder,
  isFolderSupported,
  pickFolder,
  restoreFolder,
  type FolderStore,
} from '@/data/folder-store'
import { BACKUP_TABLES, exportAll, importAll } from '@/data/queries'
import { integer } from '@/lib/format'

/**
 * Conecta o app a uma pasta do disco.
 *
 * O ponto delicado é a troca de destino: quem já tem dados no navegador e
 * escolhe uma pasta vazia precisa poder levá-los junto, senão a impressão é de
 * que o app apagou tudo. Por isso a pergunta é feita antes, e não depois.
 */
export function WorkspaceCard() {
  const [folder, setFolder] = useState<FolderStore | null>(() => currentFolder())
  const [remembered, setRemembered] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [migration, setMigration] = useState<{ store: FolderStore; localRows: number } | null>(null)

  useEffect(() => {
    void hasRememberedFolder().then(setRemembered)
  }, [])

  const supported = isFolderSupported()

  async function connect(store: FolderStore | null) {
    if (!store) return
    setError(null)

    const check = await store.verify()
    if (!check.ok) {
      setError(check.error)
      return
    }

    // Pasta já usada: entra direto, os dados dela mandam.
    if (check.existing) {
      await activate(store)
      return
    }

    // Pasta nova: se há dados aqui, pergunta se leva junto.
    const current = await exportAll()
    const localRows = Object.values(current).reduce((sum, rows) => sum + rows.length, 0)
    if (localRows > 0) {
      setMigration({ store, localRows })
      return
    }

    await store.writeManifest()
    await activate(store)
  }

  async function activate(store: FolderStore) {
    setFolderStore(store)
    setFolder(store)
    // Recarrega para todo o cache de consultas nascer lendo da pasta.
    location.reload()
  }

  async function copyAndActivate() {
    if (!migration) return
    setBusy(true)
    try {
      const current = await exportAll()
      await migration.store.writeManifest()
      setFolderStore(migration.store)
      await importAll(current)
      location.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível copiar os dados.')
      setFolderStore(null)
      setBusy(false)
      setMigration(null)
    }
  }

  async function startEmpty() {
    if (!migration) return
    setBusy(true)
    await migration.store.writeManifest()
    await activate(migration.store)
  }

  async function disconnect() {
    if (!confirm('Desconectar a pasta? Os arquivos continuam lá; o app volta a usar este navegador.')) {
      return
    }
    await forgetFolder()
    setFolderStore(null)
    location.reload()
  }

  if (!supported) {
    return (
      <Card>
        <CardHeader
          title="Pasta de trabalho"
          description="Não disponível neste navegador"
          action={<Badge>Indisponível</Badge>}
        />
        <CardContent>
          <p className="text-fg-muted text-sm">
            A API que dá acesso a pastas do disco existe só no <strong>Chrome e no Edge, no
            computador</strong>. Firefox, Safari e os navegadores de celular não a implementam.
          </p>
          <p className="text-fg-subtle mt-2 text-xs">
            Aqui, o caminho para levar os dados de uma máquina para outra continua sendo exportar e
            restaurar o backup — ou conectar o Supabase, que sincroniza em qualquer aparelho.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title="Pasta de trabalho"
        description={
          folder
            ? `Lendo e gravando em ${folder.name}`
            : 'Guarde os dados numa pasta sua, dentro do Drive ou do OneDrive'
        }
        action={
          <Badge tone={folder ? 'positive' : 'neutral'}>
            {folder ? <FolderSync className="size-3" /> : <FolderOpen className="size-3" />}
            {folder ? 'Conectada' : 'Desconectada'}
          </Badge>
        }
      />
      <CardContent className="space-y-4">
        {folder ? (
          <>
            <p className="text-fg-muted text-sm">
              Cada tabela é um arquivo JSON dentro de <strong>{folder.name}</strong>. Se a pasta
              estiver dentro do Google Drive ou do OneDrive, é o próprio serviço que leva os dados
              para os seus outros computadores.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => void disconnect()}>
                <Unplug />
                Desconectar
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-fg-muted text-sm">
              Escolha uma pasta e o app passa a guardar tudo nela, em arquivos JSON legíveis — um
              por tabela. Aponte para dentro da pasta sincronizada do Drive ou do OneDrive e os
              dados acompanham você entre computadores, sem servidor e sem conta.
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  void pickFolder()
                    .then(connect)
                    .catch((cause: unknown) => {
                      // Fechar o seletor sem escolher não é erro.
                      if (cause instanceof DOMException && cause.name === 'AbortError') return
                      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a pasta.')
                    })
                    .finally(() => setBusy(false))
                }}
              >
                <FolderOpen />
                Escolher pasta
              </Button>

              {remembered && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true)
                    void restoreFolder(true)
                      .then(connect)
                      .finally(() => setBusy(false))
                  }}
                >
                  <FolderSync />
                  Reconectar a última
                </Button>
              )}
            </div>

            {remembered && (
              <p className="text-fg-subtle flex items-start gap-1.5 text-[11px]">
                <Info className="mt-0.5 size-3 shrink-0" />
                O navegador lembra da pasta, mas pede a permissão de novo a cada sessão — por
                segurança, ela só pode ser concedida a partir de um clique seu.
              </p>
            )}
          </>
        )}

        {error && (
          <p className="text-negative bg-negative/10 rounded-lg px-3 py-2 text-xs font-medium">
            {error}
          </p>
        )}
      </CardContent>

      <Modal
        open={migration !== null}
        onClose={() => setMigration(null)}
        title="Levar os dados para a pasta?"
        description="A pasta escolhida está vazia e este navegador tem registros."
        footer={
          <>
            <Button variant="ghost" onClick={() => void startEmpty()} disabled={busy}>
              Começar vazia
            </Button>
            <Button onClick={() => void copyAndActivate()} disabled={busy}>
              {busy ? 'Copiando…' : 'Copiar os dados'}
            </Button>
          </>
        }
      >
        {migration && (
          <p className="text-fg-muted text-sm">
            Há <strong className="text-fg">{integer(migration.localRows)} registros</strong> neste
            navegador, em {BACKUP_TABLES.length} tabelas. Copiando, eles passam a viver na pasta e
            seguem você entre computadores. Começando vazia, eles continuam aqui no navegador,
            intactos, mas o app deixa de mostrá-los enquanto a pasta estiver conectada.
          </p>
        )}
      </Modal>
    </Card>
  )
}
