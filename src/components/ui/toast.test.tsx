// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Toast, ToastArea } from './toast'

afterEach(() => cleanup())

describe('área de avisos', () => {
  it('avisos de áreas diferentes se empilham no mesmo canto, em vez de um cobrir o outro', () => {
    render(
      <>
        <ToastArea>
          <Toast title="Lançado em novembro" duration={null} onClose={() => {}} />
        </ToastArea>
        <ToastArea>
          <Toast title="Compra no cartão ficou de fora" duration={null} onClose={() => {}} />
        </ToastArea>
      </>,
    )

    const primeiro = screen.getByText('Lançado em novembro').closest('[role="status"]')
    const segundo = screen.getByText('Compra no cartão ficou de fora').closest('[role="status"]')
    expect(primeiro?.parentElement).toBeTruthy()
    expect(primeiro?.parentElement).toBe(segundo?.parentElement)
  })
})
