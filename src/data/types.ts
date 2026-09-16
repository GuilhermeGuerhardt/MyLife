/**
 * Modelos do domínio. Os nomes de campo são iguais aos das colunas no Postgres
 * (snake_case), para o adaptador do Supabase não precisar mapear nada.
 */

import type { ActivityLevel, Sex } from '@/lib/health/formulas'
// O status da disciplina mora junto das regras que o interpretam.
import type { SubjectStatus } from '@/lib/education/academics'
import type { HabitCadence } from '@/lib/habits/habits'

export type { HabitCadence, SubjectStatus }

export interface BaseRow {
  id: string
  user_id?: string | null
  created_at: string
  updated_at?: string | null
}

export interface Profile extends BaseRow {
  name: string
  birthdate: string | null
  sex: Sex
  height_cm: number
  activity_level: ActivityLevel
  /** Foto de perfil, já recortada em quadrado (ver `lib/avatar.ts`). */
  avatar_url: string | null
}

export type ActivityCategory = 'sport' | 'strength' | 'cardio' | 'mobility' | 'other'

export interface ActivityType extends BaseRow {
  name: string
  /** MET: múltiplo do gasto em repouso. Base do cálculo de calorias da sessão. */
  met: number
  category: ActivityCategory
  icon: string
  /** Se a atividade pede distância (corrida, natação, ciclismo). */
  tracks_distance: boolean
  is_custom: boolean
  /** Ativa = aparece no registro rápido e conta nas metas. */
  enabled: boolean
  weekly_goal: number | null
}

export interface WorkoutSession extends BaseRow {
  activity_type_id: string
  date: string
  duration_min: number
  /** Percepção de esforço, 1 a 10. */
  rpe: number | null
  calories_estimated: number
  distance_km: number | null
  notes: string | null
}

export interface BodyMeasurement extends BaseRow {
  date: string
  weight_kg: number
  body_fat_pct: number | null
  waist_cm: number | null
  hip_cm: number | null
  arm_cm: number | null
  thigh_cm: number | null
  chest_cm: number | null
  notes: string | null
}

export interface DailyMetric extends BaseRow {
  date: string
  sleep_hours: number | null
  sleep_quality: number | null
  steps: number | null
  water_ml: number | null
  mood: number | null
  energy: number | null
  resting_hr: number | null
}

export interface DietPlanRow extends BaseRow {
  start_date: string
  start_weight_kg: number
  target_weight_kg: number
  target_date: string | null
  bmr: number
  tdee: number
  daily_calories: number
  daily_deficit: number
  weekly_loss_kg: number
  protein_g: number
  fat_g: number
  carb_g: number
  estimated_date: string
  status: 'active' | 'archived'
}

export type FoodSource = 'taco' | 'off' | 'custom'

export interface Food extends BaseRow {
  name: string
  brand: string | null
  source: FoodSource
  barcode: string | null
  /** Todos os valores são por 100 g / 100 ml. */
  kcal: number
  protein_g: number
  carb_g: number
  fat_g: number
  fiber_g: number
  /** Porção usual, em gramas — evita ter que digitar 100 toda vez. */
  serving_g: number
  serving_label: string
  favorite: boolean
}

export type MealSlot = 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner' | 'supper'

export const MEAL_SLOTS: Array<{ id: MealSlot; label: string }> = [
  { id: 'breakfast', label: 'Café da manhã' },
  { id: 'morning_snack', label: 'Lanche da manhã' },
  { id: 'lunch', label: 'Almoço' },
  { id: 'afternoon_snack', label: 'Lanche da tarde' },
  { id: 'dinner', label: 'Jantar' },
  { id: 'supper', label: 'Ceia' },
]

export interface MealLog extends BaseRow {
  date: string
  slot: MealSlot
  food_id: string
  food_name: string
  quantity_g: number
  kcal: number
  protein_g: number
  carb_g: number
  fat_g: number
}

// ---------------------------------------------------------------------------
// Educação — faculdade e cursos compartilham as mesmas tabelas.
// O campo `track` separa os dois mundos sem duplicar modelo.
// ---------------------------------------------------------------------------

/**
 * `free` só existe para anotação: é o estudo que você faz por conta, sem curso
 * nenhum por trás. Nenhum `Program` ou `Institution` nasce com esse trilho —
 * quem o carrega é sempre uma `Note` sem `program_id`.
 */
export type Track = 'academic' | 'course' | 'free'

/** Trilho de um programa — o subconjunto de `Track` que vira curso de verdade. */
export type ProgramTrack = Exclude<Track, 'free'>

export const TRACK_LABELS: Record<Track, string> = {
  academic: 'Faculdade',
  course: 'Cursos',
  free: 'Estudos',
}

/** A ordem em que os trilhos aparecem na árvore do caderno. */
export const TRACK_ORDER: Track[] = ['academic', 'course', 'free']

export interface Institution extends BaseRow {
  name: string
  track: ProgramTrack
  /** Site ou portal do aluno. */
  link: string | null
}

export type Degree = 'graduacao' | 'pos' | 'mba' | 'tecnico' | 'livre'

export const DEGREE_LABELS: Record<Degree, string> = {
  graduacao: 'Graduação',
  pos: 'Pós-graduação',
  mba: 'MBA',
  tecnico: 'Técnico',
  livre: 'Livre',
}

export type ProgramStatus = 'planned' | 'active' | 'paused' | 'done' | 'dropped'

export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  planned: 'Planejado',
  active: 'Em andamento',
  paused: 'Pausado',
  done: 'Concluído',
  dropped: 'Abandonado',
}

export interface Program extends BaseRow {
  institution_id: string | null
  track: ProgramTrack
  name: string
  degree: Degree
  status: ProgramStatus
  total_hours: number
  complementary_hours_required: number
  complementary_hours_done: number
  start_date: string | null
  expected_end: string | null
  /** Semestre atual (faculdade). */
  current_term: number | null
  /** Nota mínima para aprovação — varia por instituição. */
  passing_grade: number
  link: string | null
  instructor: string | null
  cost: number | null
  /** Avaliação pessoal do curso, 1 a 5. */
  rating: number | null
  /**
   * O certificado como imagem: a foto enviada, ou a primeira página do PDF.
   * É o que o cartão do curso mostra em miniatura.
   */
  certificate_url: string | null
  /** O PDF original, quando o certificado foi enviado nesse formato. */
  certificate_pdf: string | null
  notes: string | null
}

export interface Subject extends BaseRow {
  program_id: string
  name: string
  code: string | null
  hours: number
  credits: number
  /** Período sugerido na grade curricular. */
  period: number | null
  status: SubjectStatus
  /** Semestre em que foi/está sendo cursada, ex.: "2026.1". */
  term_label: string | null
  grade: number | null
  absences: number
  total_classes: number | null
  /** IDs de outras disciplinas do mesmo curso. */
  prerequisites: string[]
  /** Grade semanal: 0 = domingo. */
  weekday: number | null
  start_time: string | null
  end_time: string | null
  room: string | null
}

export interface Assessment extends BaseRow {
  subject_id: string
  name: string
  weight: number
  grade: number | null
  date: string | null
}

export interface CourseLesson extends BaseRow {
  program_id: string
  /** Módulo/seção a que a aula pertence. */
  module: string
  title: string
  duration_min: number
  done: boolean
  position: number
}

export interface Note extends BaseRow {
  /** Único lugar onde `free` aparece: anotação que não pertence a curso algum. */
  track: Track
  program_id: string | null
  subject_id: string | null
  title: string
  /** Conteúdo em Markdown. */
  content: string
  tags: string[]
  pinned: boolean
}

// ---------------------------------------------------------------------------
// Financeiro. Todo valor é inteiro, em centavos (ver lib/finance/money.ts).
// ---------------------------------------------------------------------------

export type AccountKind = 'checking' | 'savings' | 'cash' | 'credit' | 'investment'

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  checking: 'Conta corrente',
  savings: 'Poupança',
  cash: 'Carteira',
  credit: 'Cartão de crédito',
  investment: 'Investimento',
}

export interface Account extends BaseRow {
  name: string
  kind: AccountKind
  bank: string | null
  initial_balance_cents: number
  /** Só para cartão. */
  credit_limit_cents: number | null
  closing_day: number | null
  due_day: number | null
  color: string
  archived: boolean
}

export type TransactionKind = 'income' | 'expense' | 'transfer'

export interface Category extends BaseRow {
  name: string
  kind: 'income' | 'expense'
  color: string
  icon: string
  /** Palavras que identificam a categoria na importação e no registro rápido. */
  keywords: string[]
}

export interface Transaction extends BaseRow {
  account_id: string
  /** Conta de destino, só em transferências. */
  transfer_account_id: string | null
  category_id: string | null
  kind: TransactionKind
  /** Sempre positivo — o sinal vem de `kind`. */
  amount_cents: number
  /** Data em que aconteceu. */
  date: string
  /** Fatura/mês a que pertence (AAAA-MM). Difere de `date` em compras no cartão. */
  competence: string
  description: string
  tags: string[]
  paid: boolean
  /** Agrupa as parcelas de uma mesma compra. */
  installment_group_id: string | null
  installment_n: number | null
  installment_total: number | null
  recurring_id: string | null
  notes: string | null
}

export interface Budget extends BaseRow {
  category_id: string
  competence: string
  limit_cents: number
}

export interface FinancialGoal extends BaseRow {
  name: string
  target_cents: number
  current_cents: number
  target_date: string | null
  account_id: string | null
  color: string
  done: boolean
}

export interface RecurringTransaction extends BaseRow {
  description: string
  account_id: string
  category_id: string | null
  kind: 'income' | 'expense'
  amount_cents: number
  /** Dia do mês em que se repete. */
  day_of_month: number
  start_date: string
  end_date: string | null
  active: boolean
}

/**
 * Compromisso do calendário. Quando aponta para um curso ou disciplina, é o
 * mesmo registro que aparece na agenda e na tela do curso — marcar concluído
 * num lugar altera o outro porque não existem duas cópias.
 */
export interface Deadline extends BaseRow {
  program_id: string | null
  subject_id: string | null
  title: string
  kind: 'prova' | 'trabalho' | 'entrega' | 'aula'
  /** Data de início. Nula em compromisso de um dia só, onde `date` basta. */
  start_date: string | null
  /** Data de entrega — o fim do período, quando há início. */
  date: string
  done: boolean
  notes: string | null
}

// ---------------------------------------------------------------------------
// Transversais — o que atravessa os módulos.
// ---------------------------------------------------------------------------

/** Área a que o hábito pertence. Serve para agrupar e para herdar a cor. */
export type LifeArea = 'health' | 'education' | 'finance' | 'other'

export const LIFE_AREA_LABELS: Record<LifeArea, string> = {
  health: 'Saúde',
  education: 'Estudos',
  finance: 'Financeiro',
  other: 'Pessoal',
}

export interface Habit extends BaseRow {
  name: string
  icon: string
  area: LifeArea
  cadence: HabitCadence
  /** Dias por semana esperados. Em hábito diário, o app usa 7. */
  target_per_week: number
  archived: boolean
  position: number
  notes: string | null
}

/** Um registro por dia; a lib de hábitos deduplica se vier repetido. */
export interface HabitLog extends BaseRow {
  habit_id: string
  date: string
}

export interface DashboardWidget extends BaseRow {
  /** Identificador do widget no catálogo (`src/features/dashboard/widgets`). */
  widget: string
  position: number
  visible: boolean
}
