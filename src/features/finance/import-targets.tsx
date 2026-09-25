/** Para onde vai cada conta e cada categoria citada no arquivo. */

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, Select } from '@/components/ui/field'
import type { Account, Category } from '@/data/types'
import { chaveDaCategoria, CREATE, IGNORE, type LabelKind } from './use-import'

export function ImportAccounts({
  labels,
  accounts,
  choice,
  onChoose,
  fallbackAccount,
  onFallbackChange,
}: {
  labels: string[]
  accounts: Account[]
  choice: Record<string, string>
  onChoose: (label: string, value: string) => void
  /** Usada quando o arquivo não traz coluna de conta. */
  fallbackAccount: string
  onFallbackChange: (id: string) => void
}) {
  return (
    <Card>
      <CardHeader title="Contas" description="Para onde vai cada conta citada no arquivo" />
      <CardContent className="space-y-3">
        {labels.length === 0 ? (
          <Field
            label="Conta de destino"
            hint="O arquivo não traz coluna de conta — tudo entra nesta."
          >
            <Select value={fallbackAccount} onChange={(event) => onFallbackChange(event.target.value)}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          labels.map((label) => (
            <Field key={label} label={label}>
              <Select
                value={choice[label] ?? CREATE}
                onChange={(event) => onChoose(label, event.target.value)}
              >
                <option value={CREATE}>+ Criar conta "{label}"</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </Field>
          ))
        )}
      </CardContent>
    </Card>
  )
}

export function ImportCategories({
  labels,
  categories,
  choice,
  onChoose,
}: {
  labels: LabelKind[]
  categories: Category[]
  choice: Record<string, string>
  onChoose: (chave: string, value: string) => void
}) {
  // Um rótulo que aparece nos dois tipos vira dois campos. Sem dizer qual é
  // qual, a tela mostraria "Empréstimo" duas vezes sem explicação.
  const nosDoisTipos = new Set(
    labels
      .filter((atual) => labels.some((outro) => outro.label === atual.label && outro.kind !== atual.kind))
      .map((item) => item.label),
  )

  return (
    <Card>
      <CardHeader
        title="Categorias"
        description="O palpite vem das palavras-chave que o app já usa no registro rápido"
      />
      <CardContent className="max-h-80 space-y-3 overflow-y-auto">
        {labels.length === 0 ? (
          <p className="text-fg-subtle text-sm">
            O arquivo não traz categoria. Os lançamentos entram sem categoria e você classifica
            depois.
          </p>
        ) : (
          labels.map(({ label, kind }) => (
            <Field
              key={chaveDaCategoria(label, kind)}
              label={label}
              hint={nosDoisTipos.has(label) ? (kind === 'income' ? 'receita' : 'despesa') : undefined}
            >
              <Select
                value={choice[chaveDaCategoria(label, kind)] ?? CREATE}
                onChange={(event) => onChoose(chaveDaCategoria(label, kind), event.target.value)}
              >
                <option value={CREATE}>+ Criar categoria "{label}"</option>
                <option value={IGNORE}>— sem categoria —</option>
                {categories
                  .filter((category) => category.kind === kind)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </Select>
            </Field>
          ))
        )}
      </CardContent>
    </Card>
  )
}
