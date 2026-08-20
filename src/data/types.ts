/**
 * Modelos do domínio. Os nomes de campo são iguais aos das colunas no Postgres
 * (snake_case), para o adaptador do Supabase não precisar mapear nada.
 */

import type { ActivityLevel, Sex } from '@/lib/health/formulas'
// O status da disciplina mora junto das regras que o interpretam.
import type { SubjectStatus } from '@/lib/education/academics'

export type { SubjectStatus }

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

export type Track = 'academic' | 'course'

export interface Institution extends BaseRow {
  name: string
  track: Track
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
  track: Track
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
  certificate_url: string | null
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
  track: Track
  program_id: string | null
  subject_id: string | null
  title: string
  /** Conteúdo em Markdown. */
  content: string
  tags: string[]
  pinned: boolean
}

export interface Deadline extends BaseRow {
  program_id: string | null
  subject_id: string | null
  title: string
  kind: 'prova' | 'trabalho' | 'entrega' | 'aula'
  date: string
  done: boolean
  notes: string | null
}
