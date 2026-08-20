import { describe, expect, it } from 'vitest'
import {
  MANIFEST_FILE,
  WORKSPACE_VERSION,
  buildManifest,
  checkManifest,
  deviceName,
  parseTableFile,
  serializeTable,
  tableFilename,
  tableFromFilename,
} from './files'

describe('nomes de arquivo', () => {
  it('uma tabela vira um arquivo', () => {
    expect(tableFilename('habits')).toBe('habits.json')
    expect(tableFromFilename('habits.json')).toBe('habits')
  })

  it('o manifesto não é tabela', () => {
    expect(tableFromFilename(MANIFEST_FILE)).toBeNull()
  })

  it('arquivo de outro tipo é ignorado', () => {
    expect(tableFromFilename('anotacoes.txt')).toBeNull()
    expect(tableFromFilename('.DS_Store')).toBeNull()
  })
})

describe('manifesto', () => {
  it('carimba app e versão', () => {
    const manifest = buildManifest('Windows', '2026-08-20T12:00:00.000Z')
    expect(manifest).toEqual({
      app: 'life',
      version: WORKSPACE_VERSION,
      updated_at: '2026-08-20T12:00:00.000Z',
      device: 'Windows',
    })
  })

  it('aceita pasta já usada pelo Life', () => {
    const check = checkManifest(buildManifest('Mac', '2026-08-20T12:00:00.000Z'))
    expect(check.ok).toBe(true)
  })

  it('recusa pasta de outro aplicativo', () => {
    // Gravar por cima de dados que não são nossos é o erro irreversível aqui.
    const check = checkManifest({ app: 'outro', version: 1 })
    expect(check).toMatchObject({ ok: false })
    if (!check.ok) expect(check.error).toContain('outro aplicativo')
  })

  it('recusa pasta de versão futura', () => {
    const check = checkManifest({ app: 'life', version: WORKSPACE_VERSION + 3 })
    expect(check).toMatchObject({ ok: false })
    if (!check.ok) expect(check.error).toContain('versão mais nova')
  })

  it('recusa arquivo que não é objeto', () => {
    expect(checkManifest('life')).toMatchObject({ ok: false })
    expect(checkManifest([])).toMatchObject({ ok: false })
    expect(checkManifest(null)).toMatchObject({ ok: false })
  })
})

describe('arquivo de tabela', () => {
  it('arquivo vazio é tabela ainda não usada', () => {
    expect(parseTableFile('', 'habits')).toEqual([])
    expect(parseTableFile('   \n', 'habits')).toEqual([])
  })

  it('lê a lista de linhas', () => {
    expect(parseTableFile('[{"id":"h1"}]', 'habits')).toEqual([{ id: 'h1' }])
  })

  it('arquivo corrompido lança em vez de devolver lista vazia', () => {
    // Devolver [] faria o app parecer vazio, e a próxima gravação apagaria o
    // que estava lá.
    expect(() => parseTableFile('{quebrado', 'habits')).toThrow('não é um JSON válido')
  })

  it('objeto no lugar de lista também lança', () => {
    expect(() => parseTableFile('{"id":"h1"}', 'habits')).toThrow('deveria conter uma lista')
  })

  it('grava indentado e com quebra final', () => {
    const text = serializeTable([{ id: 'h1' }])
    expect(text).toBe('[\n  {\n    "id": "h1"\n  }\n]\n')
    expect(parseTableFile(text, 'habits')).toEqual([{ id: 'h1' }])
  })
})

describe('nome do dispositivo', () => {
  it('reconhece os sistemas comuns', () => {
    expect(deviceName('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows')
    expect(deviceName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('Mac')
    expect(deviceName('Mozilla/5.0 (Linux; Android 14)')).toBe('Android')
    expect(deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('iOS')
    expect(deviceName('algo estranho')).toBe('Desconhecido')
  })

  it('Android vem antes de Linux, porque o user agent tem os dois', () => {
    expect(deviceName('Mozilla/5.0 (Linux; Android 14; Pixel)')).toBe('Android')
  })
})
