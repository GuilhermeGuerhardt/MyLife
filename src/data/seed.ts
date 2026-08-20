/**
 * Dados iniciais.
 *
 * - Catálogo de atividades com valores MET do Compendium of Physical Activities.
 * - Amostra de alimentos com base na TACO (Tabela Brasileira de Composição de
 *   Alimentos), valores por 100 g. Na Fase 2 a tabela completa entra como seed
 *   SQL no Supabase e o Open Food Facts cobre os industrializados por código
 *   de barras.
 */

import type { ActivityType, Food } from './types'

type SeedActivity = Omit<ActivityType, keyof import('./types').BaseRow>

export const ACTIVITY_CATALOG: SeedActivity[] = [
  { name: 'Futvôlei', met: 8, category: 'sport', icon: '🏐', tracks_distance: false, is_custom: false, enabled: true, weekly_goal: 2 },
  { name: 'Academia (musculação)', met: 5, category: 'strength', icon: '🏋️', tracks_distance: false, is_custom: false, enabled: true, weekly_goal: 4 },
  { name: 'Corrida', met: 10, category: 'cardio', icon: '🏃', tracks_distance: true, is_custom: false, enabled: true, weekly_goal: 2 },
  { name: 'Natação', met: 7, category: 'cardio', icon: '🏊', tracks_distance: true, is_custom: false, enabled: true, weekly_goal: 1 },
  { name: 'Caminhada', met: 4.3, category: 'cardio', icon: '🚶', tracks_distance: true, is_custom: false, enabled: false, weekly_goal: null },
  { name: 'Ciclismo', met: 8, category: 'cardio', icon: '🚴', tracks_distance: true, is_custom: false, enabled: false, weekly_goal: null },
  { name: 'Futebol', met: 7, category: 'sport', icon: '⚽', tracks_distance: false, is_custom: false, enabled: false, weekly_goal: null },
  { name: 'Beach tennis', met: 7, category: 'sport', icon: '🎾', tracks_distance: false, is_custom: false, enabled: false, weekly_goal: null },
  { name: 'Padel', met: 7, category: 'sport', icon: '🎾', tracks_distance: false, is_custom: false, enabled: false, weekly_goal: null },
  { name: 'Basquete', met: 6.5, category: 'sport', icon: '🏀', tracks_distance: false, is_custom: false, enabled: false, weekly_goal: null },
  { name: 'Treino funcional / HIIT', met: 8, category: 'strength', icon: '🤸', tracks_distance: false, is_custom: false, enabled: false, weekly_goal: null },
  { name: 'Luta (boxe, muay thai, jiu-jitsu)', met: 9, category: 'sport', icon: '🥊', tracks_distance: false, is_custom: false, enabled: false, weekly_goal: null },
  { name: 'Escalada', met: 8, category: 'sport', icon: '🧗', tracks_distance: false, is_custom: false, enabled: false, weekly_goal: null },
  { name: 'Pular corda', met: 11, category: 'cardio', icon: '🪢', tracks_distance: false, is_custom: false, enabled: false, weekly_goal: null },
  { name: 'Remo / ergômetro', met: 7, category: 'cardio', icon: '🚣', tracks_distance: true, is_custom: false, enabled: false, weekly_goal: null },
  { name: 'Trilha', met: 6, category: 'cardio', icon: '🥾', tracks_distance: true, is_custom: false, enabled: false, weekly_goal: null },
  { name: 'Surf', met: 5, category: 'sport', icon: '🏄', tracks_distance: false, is_custom: false, enabled: false, weekly_goal: null },
  { name: 'Dança', met: 5, category: 'cardio', icon: '💃', tracks_distance: false, is_custom: false, enabled: false, weekly_goal: null },
  { name: 'Yoga', met: 3, category: 'mobility', icon: '🧘', tracks_distance: false, is_custom: false, enabled: false, weekly_goal: null },
  { name: 'Pilates', met: 3, category: 'mobility', icon: '🤍', tracks_distance: false, is_custom: false, enabled: false, weekly_goal: null },
  { name: 'Alongamento', met: 2.3, category: 'mobility', icon: '🧎', tracks_distance: false, is_custom: false, enabled: false, weekly_goal: null },
]

type SeedFood = Omit<Food, keyof import('./types').BaseRow>

/** Valores por 100 g. Fonte: TACO (4ª edição), arredondados. */
export const FOOD_CATALOG: SeedFood[] = [
  f('Arroz branco cozido', 128, 2.5, 28.1, 0.2, 1.6, 100, '1 escumadeira'),
  f('Arroz integral cozido', 124, 2.6, 25.8, 1.0, 2.7, 100, '1 escumadeira'),
  f('Feijão carioca cozido', 76, 4.8, 13.6, 0.5, 8.5, 80, '1 concha'),
  f('Feijão preto cozido', 77, 4.5, 14.0, 0.5, 8.4, 80, '1 concha'),
  f('Peito de frango grelhado', 159, 32.0, 0, 2.5, 0, 120, '1 filé'),
  f('Coxa de frango assada (sem pele)', 187, 26.9, 0, 8.4, 0, 90, '1 unidade'),
  f('Patinho bovino grelhado', 219, 35.9, 0, 7.3, 0, 120, '1 bife'),
  f('Ovo de galinha cozido', 146, 13.3, 0.6, 9.5, 0, 50, '1 unidade'),
  f('Ovo mexido', 174, 12.0, 1.5, 13.0, 0, 60, '1 porção'),
  f('Salmão grelhado', 211, 23.9, 0, 12.7, 0, 130, '1 posta'),
  f('Atum em conserva (light)', 166, 26.2, 0, 6.0, 0, 80, '1/2 lata'),
  f('Tilápia grelhada', 128, 26.0, 0, 2.3, 0, 120, '1 filé'),
  f('Batata doce cozida', 77, 0.6, 18.4, 0.1, 2.2, 130, '1 unidade média'),
  f('Batata inglesa cozida', 52, 1.2, 11.9, 0, 1.3, 130, '1 unidade média'),
  f('Mandioca cozida', 125, 0.6, 30.1, 0.3, 1.6, 100, '1 pedaço'),
  f('Macarrão cozido', 102, 3.5, 19.9, 1.3, 1.6, 150, '1 prato raso'),
  f('Pão francês', 300, 8.0, 58.6, 3.1, 2.3, 50, '1 unidade'),
  f('Pão de forma integral', 253, 9.4, 49.9, 3.7, 6.9, 50, '2 fatias'),
  f('Tapioca (goma hidratada)', 240, 0.1, 59.0, 0, 0.4, 60, '1 unidade'),
  f('Aveia em flocos', 394, 13.9, 66.6, 8.5, 9.1, 30, '3 colheres de sopa'),
  f('Pão de queijo', 363, 5.0, 40.0, 20.0, 0.7, 40, '1 unidade'),
  f('Leite integral', 61, 2.9, 4.3, 3.2, 0, 200, '1 copo'),
  f('Leite desnatado', 35, 3.4, 4.9, 0.2, 0, 200, '1 copo'),
  f('Iogurte natural integral', 51, 4.1, 1.9, 3.0, 0, 170, '1 pote'),
  f('Queijo minas frescal', 264, 17.4, 3.2, 20.2, 0, 30, '1 fatia'),
  f('Queijo mussarela', 330, 25.0, 3.0, 25.0, 0, 20, '1 fatia'),
  f('Requeijão cremoso', 257, 9.6, 3.0, 22.6, 0, 30, '1 colher de sopa'),
  f('Whey protein concentrado', 400, 80.0, 8.0, 5.0, 0, 30, '1 scoop'),
  f('Banana prata', 98, 1.3, 26.0, 0.1, 2.0, 86, '1 unidade'),
  f('Maçã com casca', 56, 0.3, 15.2, 0, 1.3, 130, '1 unidade'),
  f('Mamão papaia', 40, 0.5, 10.4, 0.1, 1.0, 170, '1/2 unidade'),
  f('Laranja pera', 37, 1.0, 8.9, 0.1, 0.8, 130, '1 unidade'),
  f('Abacate', 96, 1.2, 6.0, 8.4, 6.3, 100, '1/2 unidade'),
  f('Alface crespa', 11, 1.3, 1.7, 0.2, 1.8, 40, '1 prato'),
  f('Tomate', 15, 1.1, 3.1, 0.2, 1.2, 80, '1 unidade'),
  f('Brócolis cozido', 25, 2.1, 4.4, 0.5, 3.4, 80, '1 xícara'),
  f('Cenoura crua', 34, 1.3, 7.7, 0.2, 3.2, 60, '1 unidade'),
  f('Azeite de oliva', 884, 0, 0, 100, 0, 8, '1 colher de sopa'),
  f('Castanha-do-pará', 643, 14.5, 15.1, 63.5, 7.9, 20, '4 unidades'),
  f('Amendoim torrado', 544, 27.2, 20.3, 43.9, 8.0, 25, '1 punhado'),
  f('Pasta de amendoim integral', 588, 25.0, 20.0, 50.0, 6.0, 20, '1 colher de sopa'),
  f('Café sem açúcar', 2, 0.1, 0.3, 0, 0, 100, '1 xícara'),
  f('Suco de laranja natural', 37, 0.7, 8.7, 0.1, 0.1, 250, '1 copo'),
  f('Cerveja (lager)', 43, 0.5, 3.6, 0, 0, 350, '1 lata'),
  f('Refrigerante cola', 42, 0, 10.6, 0, 0, 350, '1 lata'),
  f('Chocolate ao leite', 540, 7.2, 59.6, 30.3, 2.0, 25, '1 barra pequena'),
]

function f(
  name: string,
  kcal: number,
  protein_g: number,
  carb_g: number,
  fat_g: number,
  fiber_g: number,
  serving_g: number,
  serving_label: string,
): SeedFood {
  return {
    name,
    brand: null,
    source: 'taco',
    barcode: null,
    kcal,
    protein_g,
    carb_g,
    fat_g,
    fiber_g,
    serving_g,
    serving_label,
    favorite: false,
  }
}
