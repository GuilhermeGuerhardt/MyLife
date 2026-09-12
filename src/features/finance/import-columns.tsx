import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, Select } from '@/components/ui/field'
import { Callout } from '@/components/ui/misc'
import {
  FIELD_LABELS,
  missingFields,
  type ColumnMap,
  type ImportField,
} from '@/lib/finance/import'

const FIELDS = Object.keys(FIELD_LABELS) as ImportField[]

/** Qual coluna do arquivo é a data, o valor, a descrição — deduzido e corrigível. */
export function ImportColumns({
  fileName,
  header,
  dataRows,
  map,
  onChange,
}: {
  fileName: string
  header: string[]
  /** Quantas linhas de dados o arquivo tem, fora o cabeçalho. */
  dataRows: number
  map: ColumnMap
  onChange: (map: ColumnMap) => void
}) {
  const missing = missingFields(map)

  return (
    <Card>
      <CardHeader
        title="Colunas"
        description={`${fileName} · ${dataRows} linhas · o mapeamento abaixo foi deduzido do cabeçalho`}
      />
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FIELDS.map((field) => (
            <Field
              key={field}
              label={FIELD_LABELS[field]}
              error={missing.includes(field) ? 'Obrigatório' : undefined}
            >
              <Select
                value={map[field] ?? ''}
                onChange={(event) =>
                  onChange({
                    ...map,
                    [field]: event.target.value === '' ? undefined : Number(event.target.value),
                  })
                }
              >
                <option value="">— não usar —</option>
                {header.map((name, index) => (
                  <option key={index} value={index}>
                    {name || `Coluna ${index + 1}`}
                  </option>
                ))}
              </Select>
            </Field>
          ))}
        </div>

        {missing.length > 0 && (
          <Callout tone="negative" className="mt-4" icon={<AlertTriangle className="size-3.5" />}>
            Sem {missing.map((field) => FIELD_LABELS[field]).join(', ')} não dá para montar um
            lançamento. Escolha a coluna correspondente acima.
          </Callout>
        )}
      </CardContent>
    </Card>
  )
}
