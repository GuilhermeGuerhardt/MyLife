import { describe, expect, it } from 'vitest'
import {
  BACKUP_VERSION,
  backupCounts,
  backupFilename,
  buildBackup,
  parseBackup,
  splitKnownTables,
  totalRows,
} from './backup'

describe('gerar backup', () => {
  it('carimba app, versão e data', () => {
    const file = buildBackup({ habits: [{ id: 'h1' }] }, '2026-08-20T12:00:00.000Z')
    expect(file).toMatchObject({
      app: 'life',
      version: BACKUP_VERSION,
      exported_at: '2026-08-20T12:00:00.000Z',
    })
  })

  it('mantém tabela vazia no arquivo', () => {
    // Ausência significaria "não mexa nesta tabela" na restauração; vazio
    // significa "esvazie". São coisas diferentes.
    const file = buildBackup({ habits: [], notes: [{ id: 'n1' }] }, '2026-08-20T12:00:00.000Z')
    expect(Object.keys(file.tables)).toContain('habits')
    expect(file.tables.habits).toEqual([])
  })

  it('conta as linhas por tabela, da maior para a menor', () => {
    const file = buildBackup(
      { habits: [{ id: 1 }], habit_logs: [{ id: 2 }, { id: 3 }, { id: 4 }], notes: [] },
      '2026-08-20T12:00:00.000Z',
    )
    expect(backupCounts(file)).toEqual([
      { table: 'habit_logs', count: 3 },
      { table: 'habits', count: 1 },
    ])
    expect(totalRows(file)).toBe(4)
  })

  it('nomeia o arquivo pela data', () => {
    expect(backupFilename('2026-08-20')).toBe('life-backup-2026-08-20.json')
  })
})

describe('validar backup', () => {
  const valid = {
    app: 'life',
    version: 1,
    exported_at: '2026-08-20T12:00:00.000Z',
    tables: { habits: [{ id: 'h1' }] },
  }

  it('aceita o formato atual', () => {
    const result = parseBackup(valid)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.legacy).toBe(false)
      expect(result.file.tables.habits).toHaveLength(1)
    }
  })

  it('aceita o formato antigo, sem cabeçalho', () => {
    // Backups gerados pelas versões anteriores precisam continuar restauráveis.
    const result = parseBackup({ workout_sessions: [{ id: 's1' }], habits: [] })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.legacy).toBe(true)
      expect(result.file.version).toBe(0)
      expect(result.file.tables.workout_sessions).toHaveLength(1)
    }
  })

  it('recusa backup de outro aplicativo', () => {
    const result = parseBackup({ ...valid, app: 'outro' })
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) expect(result.error).toContain('outro aplicativo')
  })

  it('recusa versão mais nova que a suportada', () => {
    const result = parseBackup({ ...valid, version: BACKUP_VERSION + 5 })
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) expect(result.error).toContain('Atualize o app')
  })

  it('recusa tabela que não é lista de linhas', () => {
    // Denuncia arquivo trocado ou editado à mão, em vez de gravar pela metade.
    expect(parseBackup({ ...valid, tables: { habits: 'nada disso' } })).toMatchObject({
      ok: false,
    })
  })

  it('recusa lista, texto e nulo', () => {
    expect(parseBackup([{ id: 1 }])).toMatchObject({ ok: false })
    expect(parseBackup('{}')).toMatchObject({ ok: false })
    expect(parseBackup(null)).toMatchObject({ ok: false })
  })

  it('recusa objeto vazio em vez de apagar tudo em silêncio', () => {
    expect(parseBackup({})).toMatchObject({ ok: false })
  })

  it('um backup gerado agora volta a ser lido', () => {
    const file = buildBackup({ habits: [{ id: 'h1' }] }, '2026-08-20T12:00:00.000Z')
    const roundTrip = parseBackup(JSON.parse(JSON.stringify(file)))
    expect(roundTrip.ok).toBe(true)
    if (roundTrip.ok) expect(roundTrip.file).toEqual(file)
  })
})

describe('tabelas desconhecidas', () => {
  it('separa o que dá para restaurar do que veio a mais', () => {
    const file = buildBackup(
      { habits: [{ id: 'h1' }], flashcards: [{ id: 'f1' }] },
      '2026-08-20T12:00:00.000Z',
    )
    const split = splitKnownTables(file, ['habits', 'notes'])
    expect(Object.keys(split.known)).toEqual(['habits'])
    expect(split.unknown).toEqual(['flashcards'])
  })
})
