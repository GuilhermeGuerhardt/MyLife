/**
 * Interpretador do registro rápido (Ctrl+K).
 *
 * Aceita frases soltas em português — "peso 84,2", "corri 5km em 28min",
 * "gastei 35 no mercado" — e devolve a intenção estruturada. Regex resolve o
 * caso real de uso; como não há chamada de rede, a resposta é instantânea e
 * funciona offline.
 *
 * O objetivo é registrar em dois segundos. Se o registro custa mais que isso,
 * ninguém mantém o hábito e o dashboard vira enfeite.
 */

export type QuickIntent =
  | { kind: 'weight'; weightKg: number }
  | { kind: 'water'; ml: number }
  | { kind: 'sleep'; hours: number }
  | { kind: 'steps'; steps: number }
  | { kind: 'mood'; score: number }
  | {
      kind: 'session'
      activityId: string
      activityName: string
      durationMin: number
      distanceKm: number | null
    }
  | { kind: 'meal'; query: string; quantityG: number | null }
  | { kind: 'expense'; amount: number; description: string }
  | { kind: 'unknown'; input: string }

export interface ActivityRef {
  id: string
  name: string
}

/** Apelidos que as pessoas realmente digitam, mapeados para o catálogo. */
const ALIASES: Record<string, string[]> = {
  Corrida: ['corri', 'correr', 'corrida', 'run'],
  'Academia (musculação)': ['academia', 'musculacao', 'treino', 'treinei', 'gym', 'puxei ferro'],
  Natação: ['nadei', 'nadar', 'natacao', 'piscina'],
  Futvôlei: ['futvolei', 'futevolei', 'fut volei', 'altinha'],
  Caminhada: ['caminhei', 'caminhada', 'andei'],
  Ciclismo: ['pedalei', 'bike', 'ciclismo', 'bicicleta'],
  Futebol: ['futebol', 'joguei bola', 'pelada'],
  'Beach tennis': ['beach tennis', 'beachtennis'],
  'Treino funcional / HIIT': ['funcional', 'hiit', 'crossfit'],
  'Luta (boxe, muay thai, jiu-jitsu)': ['boxe', 'muay thai', 'jiu jitsu', 'jiujitsu', 'luta'],
  Yoga: ['yoga'],
  Pilates: ['pilates'],
}

/** Marcas de acentuação combinantes, removidas na normalização. */
const COMBINING_MARKS = /\p{M}/gu

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .trim()
}

/**
 * Converte número escrito à brasileira. O ponto é ambíguo: em "1.500" é
 * milhar, em "84.2" é decimal. A regra: com vírgula presente, o ponto é sempre
 * milhar; sem vírgula, só é milhar quando separa exatamente 3 dígitos.
 */
function num(raw: string): number {
  const value = raw.trim()
  if (value.includes(',')) return Number(value.replace(/\./g, '').replace(',', '.'))
  if (/^\d{1,3}(\.\d{3})+$/.test(value)) return Number(value.replace(/\./g, ''))
  return Number(value)
}

/** Duração em minutos a partir de "45min", "1h", "1h30", "90 minutos". */
function parseDuration(text: string): number | null {
  const hm = text.match(/(\d+)\s*h(?:oras?)?\s*(\d+)?/)
  if (hm) return Number(hm[1]) * 60 + Number(hm[2] ?? 0)
  const m = text.match(/(\d+)\s*(?:min|minutos?)\b/)
  if (m) return Number(m[1])
  return null
}

export function parseQuickAdd(input: string, activities: ActivityRef[] = []): QuickIntent {
  const text = normalize(input)
  if (!text) return { kind: 'unknown', input }

  // Peso: "peso 84,2" | "pesei 84.2" | "84,2 kg"
  const weight =
    text.match(/(?:peso|pesei|pesagem)\s*:?\s*([\d.,]+)/) ?? text.match(/^([\d.,]+)\s*kg\b/)
  if (weight?.[1]) {
    const value = num(weight[1])
    if (value > 20 && value < 400) return { kind: 'weight', weightKg: value }
  }

  // Água: "agua 500ml" | "bebi 2l"
  const water = text.match(/(?:agua|bebi)\s*([\d.,]+)\s*(ml|l|litros?)?/)
  if (water?.[1]) {
    const value = num(water[1])
    const unit = water[2] ?? (value <= 10 ? 'l' : 'ml')
    return { kind: 'water', ml: unit.startsWith('l') ? Math.round(value * 1000) : Math.round(value) }
  }

  // Sono: "dormi 7h30" | "sono 8h"
  if (/\b(?:dormi|sono)\b/.test(text)) {
    const minutes = parseDuration(text)
    if (minutes) return { kind: 'sleep', hours: Math.round((minutes / 60) * 100) / 100 }
  }

  // Passos
  const steps = text.match(/([\d.]+)\s*passos/)
  if (steps?.[1]) return { kind: 'steps', steps: Math.round(num(steps[1])) }

  // Humor: "humor 8"
  const mood = text.match(/(?:humor|animo)\s*([\d]+)/)
  if (mood?.[1]) return { kind: 'mood', score: Math.min(Number(mood[1]), 10) }

  // Gasto: "gastei 35 no mercado" | "gasto 120,50 farmacia"
  const expense = text.match(/(?:gastei|gasto|paguei)\s*(?:r\$\s*)?([\d.,]+)\s*(?:no|na|em|com|de)?\s*(.*)/)
  if (expense?.[1]) {
    return {
      kind: 'expense',
      amount: num(expense[1]),
      description: (expense[2] ?? '').trim(),
    }
  }

  // Refeição: "comi 150g de arroz"
  const meal = text.match(/(?:comi|almocei|jantei|lanchei)\s*(?:([\d.,]+)\s*g\s*(?:de\s*)?)?(.*)/)
  if (meal) {
    const query = (meal[2] ?? '').trim()
    if (query) {
      return { kind: 'meal', query, quantityG: meal[1] ? num(meal[1]) : null }
    }
  }

  // Treino: encontra a atividade pelo nome ou apelido e extrai duração/distância.
  const activity = matchActivity(text, activities)
  if (activity) {
    const distance = text.match(/([\d.,]+)\s*(?:km|quilometros?)/)
    return {
      kind: 'session',
      activityId: activity.id,
      activityName: activity.name,
      durationMin: parseDuration(text) ?? 60,
      distanceKm: distance?.[1] ? num(distance[1]) : null,
    }
  }

  return { kind: 'unknown', input }
}

function matchActivity(text: string, activities: ActivityRef[]): ActivityRef | null {
  let best: { activity: ActivityRef; score: number } | null = null

  for (const activity of activities) {
    const candidates = [activity.name, ...(ALIASES[activity.name] ?? [])].map(normalize)
    for (const candidate of candidates) {
      // Nome do catálogo pode ter parênteses; compara só a primeira palavra útil.
      const token = candidate.split(/[\s(]/)[0] ?? candidate
      if (token.length < 3) continue
      if (text.includes(candidate) || text.includes(token)) {
        const score = Math.max(candidate.length, token.length)
        if (!best || score > best.score) best = { activity, score }
      }
    }
  }

  return best?.activity ?? null
}

/** Texto de confirmação mostrado antes de gravar. */
export function describeIntent(intent: QuickIntent): string {
  switch (intent.kind) {
    case 'weight':
      return `Registrar pesagem de ${intent.weightKg.toFixed(1).replace('.', ',')} kg hoje`
    case 'water':
      return `Adicionar ${intent.ml} ml de água hoje`
    case 'sleep':
      return `Registrar ${intent.hours.toString().replace('.', ',')} h de sono`
    case 'steps':
      return `Registrar ${intent.steps.toLocaleString('pt-BR')} passos hoje`
    case 'mood':
      return `Registrar humor ${intent.score}/10`
    case 'session':
      return `Registrar ${intent.activityName} · ${intent.durationMin} min${
        intent.distanceKm ? ` · ${intent.distanceKm} km` : ''
      }`
    case 'meal':
      return `Buscar "${intent.query}"${intent.quantityG ? ` (${intent.quantityG} g)` : ''} no diário alimentar`
    case 'expense':
      return `Lançar despesa de R$ ${intent.amount.toFixed(2).replace('.', ',')}${
        intent.description ? ` em ${intent.description}` : ''
      }`
    default:
      return 'Não entendi. Tente "peso 84,2", "corri 5km em 28min" ou "gastei 35 no mercado".'
  }
}
