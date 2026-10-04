import { describe, expect, it } from 'vitest'
import {
  backupsParaApagar,
  diaDoBackup,
  nomeDoBackupAutomatico,
  precisaDeBackup,
} from './automatico'

describe('backup automático', () => {
  it('o nome carrega o dia, e só ele é reconhecido', () => {
    expect(nomeDoBackupAutomatico('2026-10-04')).toBe('life-auto-2026-10-04.json')
    expect(diaDoBackup('life-auto-2026-10-04.json')).toBe('2026-10-04')
    expect(diaDoBackup('life-backup-2026-10-04.json')).toBeNull()
    expect(diaDoBackup('life-auto-2026-10-04.json.tmp')).toBeNull()
    expect(diaDoBackup('life-auto-ontem.json')).toBeNull()
  })

  it('um por dia', () => {
    expect(precisaDeBackup(null, '2026-10-04')).toBe(true)
    expect(precisaDeBackup('2026-10-03', '2026-10-04')).toBe(true)
    expect(precisaDeBackup('2026-10-04', '2026-10-04')).toBe(false)
  })

  it('apaga as mais velhas e deixa o resto da pasta em paz', () => {
    const pasta = [
      'life-auto-2026-10-01.json',
      'life-auto-2026-10-04.json',
      'life-backup-2026-09-01.json',
      'notas.txt',
      'life-auto-2026-10-02.json',
      'life-auto-2026-10-03.json',
    ]
    expect(backupsParaApagar(pasta, 2)).toEqual([
      'life-auto-2026-10-02.json',
      'life-auto-2026-10-01.json',
    ])
  })

  it('nunca apaga a cópia mais nova, mesmo pedindo zero', () => {
    expect(backupsParaApagar(['life-auto-2026-10-04.json'], 0)).toEqual([])
  })
})
