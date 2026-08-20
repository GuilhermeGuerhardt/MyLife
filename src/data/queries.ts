/**
 * Hooks de dados. Toda tela consome daqui — nenhuma fala com o adaptador direto.
 */

import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { collection, type Collection } from './adapters'
import { ACTIVITY_CATALOG, FOOD_CATALOG } from './seed'
import type {
  ActivityType,
  BaseRow,
  BodyMeasurement,
  DailyMetric,
  DietPlanRow,
  Food,
  MealLog,
  Profile,
  WorkoutSession,
} from './types'
import { uid } from '@/lib/utils'

export const TABLES = {
  profiles: 'profiles',
  activityTypes: 'activity_types',
  sessions: 'workout_sessions',
  measurements: 'body_measurements',
  dailyMetrics: 'health_metrics_daily',
  dietPlans: 'diet_plans',
  foods: 'foods',
  mealLogs: 'meal_logs',
} as const

const collections = {
  profiles: collection<Profile>(TABLES.profiles),
  activityTypes: collection<ActivityType>(TABLES.activityTypes),
  sessions: collection<WorkoutSession>(TABLES.sessions),
  measurements: collection<BodyMeasurement>(TABLES.measurements),
  dailyMetrics: collection<DailyMetric>(TABLES.dailyMetrics),
  dietPlans: collection<DietPlanRow>(TABLES.dietPlans),
  foods: collection<Food>(TABLES.foods),
  mealLogs: collection<MealLog>(TABLES.mealLogs),
}

type CollectionName = keyof typeof collections

function withMeta<T>(items: T[]): Array<T & BaseRow> {
  const now = new Date().toISOString()
  return items.map((item) => ({ ...item, id: uid(), created_at: now, updated_at: now })) as Array<
    T & BaseRow
  >
}

/** Popula o catálogo de atividades e alimentos na primeira execução. */
export async function ensureSeed(): Promise<void> {
  const [activities, foods] = await Promise.all([
    collections.activityTypes.list(),
    collections.foods.list(),
  ])
  if (activities.length === 0) {
    await collections.activityTypes.replaceAll(withMeta(ACTIVITY_CATALOG) as ActivityType[])
  }
  if (foods.length === 0) {
    await collections.foods.replaceAll(withMeta(FOOD_CATALOG) as Food[])
  }
}

function useCollection<T extends BaseRow>(name: CollectionName, key: QueryKey = [name]) {
  const client = useQueryClient()
  const store = collections[name] as unknown as Collection<T>

  const query = useQuery({ queryKey: key, queryFn: () => store.list() })

  const invalidate = () => client.invalidateQueries({ queryKey: key })

  const create = useMutation({
    mutationFn: (item: Parameters<Collection<T>['insert']>[0]) => store.insert(item),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<T> }) => store.update(id, patch),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => store.remove(id),
    onSuccess: invalidate,
  })

  return {
    data: (query.data ?? []) as T[],
    isLoading: query.isLoading,
    error: query.error,
    create,
    update,
    remove,
  }
}

export function useActivityTypes() {
  return useCollection<ActivityType>('activityTypes')
}

export function useSessions() {
  return useCollection<WorkoutSession>('sessions')
}

export function useMeasurements() {
  return useCollection<BodyMeasurement>('measurements')
}

export function useDailyMetrics() {
  return useCollection<DailyMetric>('dailyMetrics')
}

export function useDietPlans() {
  return useCollection<DietPlanRow>('dietPlans')
}

export function useFoods() {
  return useCollection<Food>('foods')
}

export function useMealLogs() {
  return useCollection<MealLog>('mealLogs')
}

const DEFAULT_PROFILE: Omit<Profile, keyof BaseRow> = {
  name: '',
  birthdate: null,
  sex: 'male',
  height_cm: 175,
  activity_level: 'moderate',
}

/** O perfil é um registro único — o hook esconde essa particularidade. */
export function useProfile() {
  const { data, create, update, isLoading } = useCollection<Profile>('profiles')
  const profile = data[0] ?? null

  const save = async (patch: Partial<Profile>) => {
    if (profile) return update.mutateAsync({ id: profile.id, patch })
    return create.mutateAsync({ ...DEFAULT_PROFILE, ...patch })
  }

  return { profile, save, isLoading, isSaving: create.isPending || update.isPending }
}
