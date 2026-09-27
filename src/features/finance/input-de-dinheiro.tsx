import type { InputHTMLAttributes } from 'react'
import { Input } from '@/components/ui/field'
import { mascaraDeDinheiro } from '@/lib/finance/money'

/**
 * O campo de valor, que escreve a vírgula sozinho.
 *
 * Digite `3550` e aparece `35,50`; o dígito seguinte empurra tudo para a
 * esquerda, como no caixa eletrônico. Antes era preciso acertar a vírgula e o
 * ponto do milhar na mão — e, na pressa, `1500` virava mil e quinhentos reais
 * onde devia ser quinze.
 *
 * O texto continua sendo texto: quem recebe o valor segue usando `parseAmount`
 * na hora de gravar, e colar `R$ 1.234,56` de um extrato dá no mesmo que
 * digitar os números.
 */
export function InputDeDinheiro({
  value,
  onChange,
  ...props
}: {
  value: string
  onChange: (valor: string) => void
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  return (
    <Input
      {...props}
      // Só dígitos entram, então o teclado do celular pode ser o numérico.
      inputMode="numeric"
      placeholder={props.placeholder ?? '0,00'}
      value={value}
      onChange={(evento) => onChange(mascaraDeDinheiro(evento.target.value))}
    />
  )
}
