import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Toggle } from '@/components/ui/misc'
import { useModulos } from './use-modulos'

/**
 * Quais módulos ficam no menu.
 *
 * Mora no Perfil porque é escolha de quem usa, não de tela: some do menu de
 * cima e da barra do celular ao mesmo tempo, e leva junto os widgets do painel
 * que só falavam daquele módulo.
 *
 * O aviso de que nada é apagado não é decoração: sem ele, desligar "Financeiro"
 * parece deletar dois anos de lançamentos, e ninguém experimenta.
 */
export function ModulosCard() {
  const { itens, temEscondido, alternar, mostrarTodos } = useModulos()

  return (
    <Card>
      <CardHeader
        title="Módulos"
        description="Desligue o que você não usa. Nada é apagado: voltar a ligar devolve tudo como estava."
        action={
          temEscondido ? (
            <Button variant="ghost" onClick={() => void mostrarTodos()}>
              Mostrar todos
            </Button>
          ) : undefined
        }
      />
      <CardContent>
        <ul className="divide-border-base divide-y">
          {itens.map((item) => (
            <li key={item.def.to} className="flex items-center gap-3 py-2.5">
              <span className={item.def.accent}>
                <item.def.icon className="text-accent size-4 shrink-0" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-fg text-sm font-medium">{item.def.label}</p>
                <p className="text-fg-subtle text-xs">
                  {item.podeEsconder
                    ? (item.def.children?.map((filho) => filho.label).join(' · ') ??
                      'Anotações e resumos')
                    : 'O painel de abertura fica sempre no menu.'}
                </p>
              </div>

              <Toggle
                checked={item.visible}
                disabled={!item.podeEsconder}
                label={`Mostrar ${item.def.label}`}
                onChange={() => void alternar(item.def.to)}
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
