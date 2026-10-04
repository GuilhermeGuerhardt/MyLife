// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

// O disco é simulado: gravar, listar e apagar passam pelo Rust, que não existe
// aqui. O que se testa é a ordem e o que fica anotado.
const disco = vi.hoisted(() => ({
  arquivos: new Map<string, string>(),
  falharGravacao: false,
  falharLimpeza: false,
}))

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: async (comando: string, args: Record<string, string>) => {
    if (comando === 'gravar_texto') {
      if (disco.falharGravacao) throw new Error('Disco cheio.')
      disco.arquivos.set(args.caminho!, args.conteudo!)
      return
    }
    if (comando === 'listar_arquivos') {
      return [...disco.arquivos.keys()].map((caminho) => caminho.split('\\').pop())
    }
    if (comando === 'apagar_backup_automatico') {
      if (disco.falharLimpeza) throw new Error('Arquivo em uso.')
      disco.arquivos.delete(args.caminho!)
      return
    }
    throw new Error(`comando inesperado: ${comando}`)
  },
}))

vi.mock('./queries', () => ({
  exportAll: async () => ({ transactions: [{ id: 'a' }, { id: 'b' }], accounts: [{ id: 'c' }] }),
}))

const { executarBackupAutomatico, fazerBackupAutomatico, gravarConfigDoBackup, lerConfigDoBackup } =
  await import('./backup-automatico')

const PASTA = 'D:\\Backups'

beforeEach(() => {
  disco.arquivos.clear()
  disco.falharGravacao = false
  disco.falharLimpeza = false
  localStorage.clear()
})

describe('gravar a cópia do dia', () => {
  it('grava um backup legível com o nome do dia', async () => {
    const resultado = await fazerBackupAutomatico(PASTA, 14, '2026-10-04')
    const conteudo = disco.arquivos.get('D:\\Backups\\life-auto-2026-10-04.json')

    expect(resultado).toEqual({ registros: 3, apagados: 0 })
    expect(JSON.parse(conteudo!)).toMatchObject({ app: 'life', tables: { accounts: [{ id: 'c' }] } })
  })

  it('apaga as mais velhas e deixa o backup manual', async () => {
    for (const nome of ['life-auto-2026-10-01.json', 'life-auto-2026-10-02.json', 'life-backup-2026-01-01.json']) {
      disco.arquivos.set(`${PASTA}\\${nome}`, '{}')
    }

    const resultado = await fazerBackupAutomatico(PASTA, 2, '2026-10-04')

    expect(resultado.apagados).toBe(1)
    expect([...disco.arquivos.keys()].sort()).toEqual([
      'D:\\Backups\\life-auto-2026-10-02.json',
      'D:\\Backups\\life-auto-2026-10-04.json',
      'D:\\Backups\\life-backup-2026-01-01.json',
    ])
  })

  it('erro na limpeza não desfaz a cópia de hoje', async () => {
    disco.arquivos.set(`${PASTA}\\life-auto-2026-09-01.json`, '{}')
    disco.falharLimpeza = true

    const resultado = await fazerBackupAutomatico(PASTA, 1, '2026-10-04')

    expect(resultado.apagados).toBe(0)
    expect(disco.arquivos.has('D:\\Backups\\life-auto-2026-10-04.json')).toBe(true)
  })
})

describe('anotar o resultado', () => {
  it('desligado não grava nada', async () => {
    await executarBackupAutomatico('2026-10-04')
    expect(disco.arquivos.size).toBe(0)
  })

  it('certo: anota o dia e limpa o erro antigo', async () => {
    gravarConfigDoBackup({ pasta: PASTA, manter: 14, ultimo: '2026-10-02', erro: 'Antigo.' })
    await executarBackupAutomatico('2026-10-04')
    expect(lerConfigDoBackup()).toEqual({ pasta: PASTA, manter: 14, ultimo: '2026-10-04', erro: null })
  })

  it('falhou: guarda a mensagem e não finge que fez', async () => {
    gravarConfigDoBackup({ pasta: PASTA, manter: 14, ultimo: '2026-10-02', erro: null })
    disco.falharGravacao = true
    await executarBackupAutomatico('2026-10-04')
    expect(lerConfigDoBackup()).toMatchObject({ ultimo: '2026-10-02', erro: 'Disco cheio.' })
  })

  it('configuração corrompida volta a desligado', () => {
    localStorage.setItem('life:backup-automatico', '{quebrado')
    expect(lerConfigDoBackup()).toEqual({ pasta: null, manter: 14, ultimo: null, erro: null })
  })
})
