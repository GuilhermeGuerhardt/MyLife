import { isTauri } from '@tauri-apps/api/core'
import { BellOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Callout, Toggle } from '@/components/ui/misc'
import { gravarPreferencias, lerPreferencias } from '@/features/lembretes/preferencias'
import { TIPOS_DE_LEMBRETE, type TipoDeLembrete } from '@/lib/lembretes/lembretes'
import {
  notificar,
  pedirPermissaoDeAviso,
  permissaoDeAviso,
  type PermissaoDeAviso,
} from '@/lib/notificacao'

/**
 * Liga os avisos do sistema e escolhe quais.
 *
 * A permissão é pedida no clique de ligar, e não na abertura do app: o
 * navegador recusa o pedido feito sem gesto, e um pedido que aparece do nada é
 * o que faz a pessoa clicar em "bloquear" sem ler.
 */
export function AvisosCard() {
  const [preferencias, setPreferencias] = useState(lerPreferencias)
  const [permissao, setPermissao] = useState<PermissaoDeAviso | null>(null)

  useEffect(() => {
    void permissaoDeAviso().then(setPermissao)
  }, [])

  function salvar(proximas: typeof preferencias) {
    setPreferencias(proximas)
    gravarPreferencias(proximas)
  }

  async function ligar(ligado: boolean) {
    if (ligado && permissao !== 'concedida') {
      const resposta = await pedirPermissaoDeAviso()
      setPermissao(resposta)
      if (resposta !== 'concedida') return
    }
    salvar({ ...preferencias, ligado })
  }

  function alternarTipo(tipo: TipoDeLembrete, ligado: boolean) {
    const tipos = ligado
      ? [...preferencias.tipos, tipo]
      : preferencias.tipos.filter((item) => item !== tipo)
    salvar({ ...preferencias, tipos })
  }

  const sistema = isTauri() ? 'O Windows' : 'O navegador'

  return (
    <Card>
      <CardHeader
        title="Avisos"
        description="Um balão no canto da tela quando algo pede atenção, mesmo com o Life minimizado. Cada situação avisa uma vez só."
        action={
          <Toggle
            checked={preferencias.ligado}
            label="Mandar avisos"
            disabled={permissao === 'indisponivel'}
            onChange={(ligado) => void ligar(ligado)}
          />
        }
      />
      <CardContent className="space-y-4">
        {permissao === 'negada' && (
          <Callout tone="warning" icon={<BellOff className="size-3.5" />}>
            {sistema} está bloqueando os avisos do Life. Libere nas configurações de notificação
            {isTauri() ? ' do Windows' : ' do site'} e ligue de novo aqui.
          </Callout>
        )}
        {permissao === 'indisponivel' && (
          <Callout tone="warning" icon={<BellOff className="size-3.5" />}>
            Este navegador não sabe mostrar avisos. No app instalado eles funcionam.
          </Callout>
        )}

        <ul className="divide-border-base divide-y">
          {TIPOS_DE_LEMBRETE.map((tipo) => (
            <li key={tipo.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-fg text-sm font-medium">{tipo.rotulo}</p>
                <p className="text-fg-subtle text-xs">{tipo.descricao}</p>
              </div>
              <Toggle
                checked={preferencias.tipos.includes(tipo.id)}
                disabled={!preferencias.ligado}
                label={`Avisar: ${tipo.rotulo}`}
                onChange={(ligado) => alternarTipo(tipo.id, ligado)}
              />
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={!preferencias.ligado}
            onClick={() =>
              void notificar('Life', 'É assim que os avisos vão aparecer.')
            }
          >
            Mandar um aviso de teste
          </Button>
          <p className="text-fg-subtle text-xs">
            Os avisos saem enquanto o Life está aberto, mesmo minimizado.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
