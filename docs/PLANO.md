# Life — Dashboard da Vida

Documento de arquitetura e escopo. Versão 1 do plano.

---

## 1. Stack

| Camada | Escolha | Porquê |
|---|---|---|
| Front | **React 19 + Vite + TypeScript** | Vite = build instantâneo e bundle enxuto. TS evita 80% dos bugs bobos num app cheio de formulários e números. |
| Estilo | **Tailwind CSS v4 + shadcn/ui** | shadcn não é dependência: o componente é copiado pro seu repo. Zero peso de biblioteca de UI, design moderno e 100% customizável. |
| Estado servidor | **TanStack Query** | Cache, revalidação, optimistic updates. Some com 90% do `useEffect`. |
| Estado local | **Zustand** | ~1 kb, sem boilerplate. |
| Rotas | **React Router v7** | Simples e estável. |
| Formulários | **React Hook Form + Zod** | Zod compartilhado entre front e back (o mesmo schema valida os dois lados). |
| Gráficos | **Recharts** (lazy-loaded) | Boa DX; carregado só na rota que usa, não pesa no first paint. |
| Datas | **date-fns** (locale pt-BR) | Tree-shakeable, ao contrário do moment. |
| Banco/Auth/Storage | **Supabase** (Postgres + RLS + Storage) | Auth pronta, RLS resolve segurança sem backend, Storage pros PDFs e fotos. |
| API (opcional) | **Hono** ou **Fastify** no Render | Só pro que não pode/deve rodar no browser (ver §3). |
| Deploy | Render Static Site (front) + Render Web Service (API) + Supabase (DB) | Já é seu fluxo. |
| Extra | **PWA** (vite-plugin-pwa) | Instala no celular e funciona offline — é o que faz você realmente registrar peso/gasto/treino na hora. |

> Sobre "JavaScript": TypeScript **é** JavaScript com tipos — compila pra JS e roda igual. Num app com cálculo de calorias, macros, juros e médias, ele se paga no primeiro mês. Se preferir JS puro, dá pra fazer tudo igual usando JSDoc pra manter autocomplete.

### Monorepo (pnpm workspaces)

```
life/
├─ apps/
│  ├─ web/          # React + Vite (PWA)
│  └─ api/          # Hono no Render (cron, integrações, imports)
├─ packages/
│  ├─ shared/       # schemas Zod, tipos do DB, fórmulas (TMB, TDEE, juros, SM-2)
│  └─ ui/           # componentes compartilhados (opcional)
└─ supabase/
   ├─ migrations/   # SQL versionado
   └─ seed/         # TACO, categorias financeiras, catálogo de atividades
```

As fórmulas ficam em `packages/shared` e são testadas com Vitest — nunca duplicadas entre front e back.

---

## 2. Módulos

### 2.1 Dashboard (home)
- **Bento grid** de widgets configuráveis (mostrar/ocultar/reordenar, salvo por usuário).
- Widgets: peso + média móvel 7d, calorias restantes hoje, treino do dia, próxima prova/entrega, gasto do mês vs orçamento, streaks, próxima aula do curso.
- **Command palette (Ctrl+K)** para registrar qualquer coisa em 2 segundos — de longe o recurso que mais determina se você vai usar o app todo dia.
- **Quick add em linguagem natural**: `gastei 35 no mercado`, `corri 5km 28min`, `peso 84.2`. Um parser por regex resolve 90% dos casos.

### 2.2 Saúde

**Atividades** — catálogo pré-cadastrado com valor MET (para estimar calorias): futvôlei, academia (musculação), natação, corrida, caminhada, ciclismo, funcional, luta, yoga, futebol, beach tennis, escalada… + criar personalizada. Você escolhe quais ficam ativas no seu perfil.

**Sessões de treino** — data, duração, intensidade (RPE 1–10), calorias estimadas (`MET × peso(kg) × horas`), notas, local.
- Corrida/natação/ciclismo: distância, pace/ritmo, splits.
- Academia: treinos nomeados (A/B/C), exercícios com séries × reps × carga, **progressão de carga**, PRs automáticos, volume semanal por grupo muscular.
- Futvôlei e esportes coletivos: duração, sets, sensação.

**Medidas corporais** — peso, altura, % de gordura, circunferências (cintura, quadril, braço, coxa, tórax), fotos de progresso (Storage privado, comparador lado a lado).

**Métricas calculadas** — IMC, relação cintura/quadril, TMB (Mifflin-St Jeor), TDEE e **média móvel de 7 dias do peso** (o peso diário oscila 1–2 kg por água/sal/intestino; a média móvel é o número que importa e evita frustração desnecessária).

**Plano de emagrecimento (o coração da área)**
1. Entradas: peso atual, altura, idade, sexo, nível de atividade, peso-meta, prazo desejado.
2. Calcula **TMB (Mifflin-St Jeor)** → **TDEE** = TMB × fator de atividade (1.2 a 1.9), ajustado pelas sessões realmente registradas na semana em vez de um fator chutado.
3. Sugere o déficit com **travas de segurança**: perda de 0,5% a 1% do peso corporal por semana, teto de ~25% de déficit e piso calórico (nunca abaixo de ~1500 kcal homens / ~1200 kcal mulheres). Se o prazo pedido exigir mais que isso, o app avisa e propõe a data realista.
4. Define **macros**: proteína 1,6–2,2 g/kg (preserva massa magra em déficit), gordura 0,8–1 g/kg, carboidrato no restante.
5. Gera a **projeção da curva de peso** com data estimada da meta.
6. **Recalibração adaptativa**: a cada 2 semanas compara a perda real com a projetada e ajusta calorias/atividade. É isso que separa um plano estático de um plano que funciona.
7. Sugestões contextuais: meta de passos, distribuição dos treinos na semana, refeição livre, alerta de platô, aviso de perda rápida demais.

> ⚠️ O app calcula estimativas com base em fórmulas públicas e **não substitui nutricionista ou médico**. Esse aviso deve aparecer na tela do plano.

**Outros trackers** — sono (horas + qualidade), água, passos, humor/energia, FC de repouso, lesões e dores. Um índice simples de **prontidão** (sono + dor + fadiga) sugere se hoje é dia de puxar ou pegar leve.

### 2.3 Alimentação (dentro de Saúde)

- **Diário por refeição**: café, lanche, almoço, lanche, janta, ceia.
- **Base de alimentos**: importar a **tabela TACO** (composição de alimentos brasileiros — essencial pra comida real: arroz, feijão, pão de queijo) + **Open Food Facts** via API para industrializados com código de barras.
- **Scanner de código de barras** pela câmera (`BarcodeDetector` nativa, com fallback `@zxing/browser`).
- **Receitas**: monta com ingredientes e o app calcula os nutrientes por porção; a receita vira um "alimento" reutilizável.
- **Refeições favoritas / copiar o dia anterior / duplicar semana** — sem isso ninguém registra dieta por mais de 10 dias.
- Anel de calorias + barras de macros, água e fibras.
- **Planejador de cardápio semanal** → gera **lista de compras** agrupada por seção do mercado.
- **Adesão %** da semana em vez de "acertou/errou" — registrar o furo sem culpa é o que mantém o hábito.
- Janela alimentar / jejum (opcional).
- O custo da alimentação alimenta a categoria "Mercado/Delivery" do módulo financeiro.

### 2.4 Faculdade (multi-instituição)

- **Instituições** → **Cursos** (nome, grau, instituição, carga horária total, início, previsão de conclusão, semestre atual). Suporta várias faculdades simultâneas ou sequenciais.
- **Grade curricular**: disciplinas com carga horária/créditos, pré-requisitos, período sugerido, status (cursada / cursando / pendente / dispensada / reprovada).
  → gera automaticamente o **% concluído do curso** e a tela **"o que falta"**, incluindo horas complementares, estágio e TCC.
- **Semestres**: disciplinas do período, notas por avaliação (com peso), faltas.
  - **Controle de faltas com o limite de 25%**: "você pode faltar mais 3 aulas em Cálculo II".
  - **Simulador**: "preciso tirar 6,5 na final pra passar".
  - CR/CRA calculado a partir do histórico.
- **Horário semanal** em grade visual.
- **Anotações e resumos**: editor Markdown (Tiptap ou Milkdown) com upload de PDF/imagem, tags, vínculo com disciplina e aula, **busca full-text em português** (`tsvector` com dicionário `portuguese` no Postgres).
- **Flashcards com repetição espaçada (SM-2 ou FSRS)** criados a partir dos resumos — transforma anotação morta em estudo de verdade. Alto valor, baixo custo de implementação.
- **Avaliações e entregas** com contagem regressiva, aparecendo no dashboard e no calendário.

### 2.5 Cursos

Mesma espinha dorsal da faculdade (compartilha tabelas onde faz sentido):
- Plataforma (Udemy, Alura, Coursera, YouTube…), link, instrutor, carga horária, custo (→ financeiro).
- Progresso por módulo/aula, com % automático e "próxima aula" no dashboard.
- Certificado (upload no Storage), data de conclusão, avaliação pessoal do curso.
- Prazo/meta de conclusão e ritmo necessário ("2 aulas/dia pra terminar até 30/09").
- **Trilhas**: agrupar cursos por objetivo ("Back-end Node", "Inglês").
- Anotações e flashcards reaproveitando o mesmo módulo da faculdade.

### 2.6 Financeiro

- **Contas**: banco, carteira, cartão de crédito, investimento — com saldo.
- **Transações**: receita / despesa / transferência, categoria + subcategoria, tags, método, anexo de comprovante.
  - **Recorrentes** (assinaturas, aluguel, mensalidade) geradas automaticamente.
  - **Parceladas**: 1 compra → N parcelas, e a fatura do cartão é fechada **por competência** (data de fechamento/vencimento), não pela data da compra. É o detalhe que quase todo app caseiro erra e que faz o número bater com a realidade.
- **Orçamento mensal por categoria** (método envelope), com barra de consumo e alerta em 80% / 100%.
- **Metas financeiras**: reserva de emergência, viagem, notebook — com aporte, prazo e projeção de quando chega.
- **Dívidas**: saldo, juros, simulador de quitação.
- **Investimentos** (fase 2): aportes, patrimônio, cotações via API BRAPI (grátis para ações BR).
- **Relatórios**: fluxo de caixa mensal, donut por categoria, evolução do patrimônio, **taxa de poupança %**, comparativo mês a mês, maiores gastos.
- **Importação de extrato OFX/CSV** com deduplicação e sugestão de categoria por regra (`contém "IFOOD" → Delivery`). Todo banco exporta OFX — isso elimina 95% da digitação manual.

### 2.7 Transversais (o que transforma vários CRUDs em um dashboard de vida)

- **Hábitos & streaks** com heatmap estilo GitHub (treinar 4×/semana, estudar 1h/dia, dormir 7h).
- **Metas anuais** ligadas aos módulos, com progresso puxado automaticamente dos dados (peso-alvo, formar em X, guardar R$ Y).
- **Calendário unificado**: aulas, provas, treinos, contas a pagar, aulas de curso — tudo junto. Export `.ics` pro Google Calendar.
- **Journal** com humor e energia diários.
- **Insights cross-módulo** — o recurso mais valioso e que quase nenhum app tem:
  - "nas semanas em que você treinou 4×, seu humor médio foi 22% maior";
  - "seus gastos com delivery sobem 40% nas semanas de prova";
  - "você perde peso 2× mais rápido nas semanas em que dorme mais de 7h".
  - Implementação: queries SQL agregando por semana + correlação simples.
- **Revisão semanal**: uma tela de segunda-feira com o resumo dos 7 dias e o plano da semana.
- **Notificações**: PWA Push ou **bot no Telegram** (barato, fácil, e permite registrar peso/gasto por mensagem sem abrir o app).
- **Export/backup** completo em JSON/CSV.

---

## 3. Backend: precisa?

Para o CRUD do dia a dia, **não** — o front fala direto com o Supabase e o **RLS** (`user_id = auth.uid()` em toda tabela) garante a segurança. Menos código, menos deploy, mais velocidade.

A API no Render entra para:
- **Cron jobs**: gerar transações recorrentes, fechar fatura, recalcular o plano de dieta, disparar lembretes, snapshot semanal de métricas.
- **Integrações com chave secreta**: Open Food Facts (com cache), BRAPI (cotações), bot do Telegram.
- **Processamento pesado**: parser de OFX/CSV, importação da TACO, geração de PDF/relatórios, export.
- Regras de negócio que não podem confiar no cliente.

Alternativa: **Supabase Edge Functions + pg_cron** cobrem quase tudo isso sem manter um serviço no Render. Vale considerar se quiser reduzir infra.

---

## 4. Modelagem do banco (esqueleto)

Todas as tabelas com `id uuid pk`, `user_id uuid` (FK → `auth.users`), `created_at`, `updated_at` e **RLS ativo**.

**Núcleo**
`profiles` (nome, data_nascimento, sexo, altura_cm, timezone, preferências, layout do dashboard)

**Saúde**
- `activity_types` (nome, ícone, met, categoria, is_custom)
- `user_activities` (activity_type_id, ativa, meta_semanal)
- `workout_sessions` (activity_type_id, data, duracao_min, rpe, calorias_est, distancia_km, notas)
- `strength_workouts` / `strength_sets` (exercise_id, série, reps, carga_kg, rir)
- `exercises` (catálogo: nome, grupo_muscular, equipamento)
- `body_measurements` (data, peso_kg, gordura_pct, cintura, quadril, braco, coxa, foto_url)
- `health_metrics_daily` (data, sono_h, sono_qualidade, passos, agua_ml, humor, energia, fc_repouso)
- `diet_plans` (peso_inicial, peso_meta, data_alvo, tmb, tdee, kcal_alvo, macros, deficit_pct, status, versao)
- `diet_plan_checkpoints` (data, peso_real, peso_projetado, ajuste_aplicado)

**Alimentação**
- `foods` (nome, marca, fonte [taco|off|custom], barcode, porcao_padrao, kcal, prot, carb, gord, fibra, sodio por 100 g)
- `recipes` / `recipe_items`
- `meal_logs` (data, refeicao, food_id | recipe_id, quantidade_g, kcal e macros calculados)
- `meal_plans` / `shopping_list_items`

**Educação (compartilhado entre faculdade e cursos)**
- `institutions` (nome, tipo [faculdade|plataforma])
- `programs` (institution_id, nome, tipo [graduacao|pos|curso], carga_horaria_total, inicio, previsao_fim, semestre_atual, status)
- `subjects` (program_id, nome, codigo, carga_horaria, creditos, periodo_sugerido, status)
- `subject_prerequisites` (subject_id, requires_subject_id)
- `terms` (program_id, nome "2026.1", inicio, fim)
- `enrollments` (term_id, subject_id, nota_final, faltas, aulas_totais, status)
- `assessments` (enrollment_id, nome, peso, nota, data)
- `class_schedule` (enrollment_id, dia_semana, hora_inicio, hora_fim, sala)
- `course_modules` / `course_lessons` (progresso por aula, para cursos)
- `notes` (program_id?, subject_id?, titulo, conteudo_md, tags[], search_vector)
- `attachments` (note_id, storage_path, tipo, tamanho)
- `flashcards` (note_id?, subject_id, frente, verso, ease, intervalo, proxima_revisao)
- `deadlines` (titulo, tipo [prova|trabalho|entrega], data, subject_id?, concluido)

**Financeiro**
- `accounts` (nome, tipo [corrente|poupanca|carteira|cartao|investimento], saldo_inicial, banco, dia_fechamento, dia_vencimento)
- `categories` (nome, tipo [receita|despesa], parent_id, cor, ícone)
- `transactions` (account_id, category_id, tipo, valor, data, data_competencia, descricao, tags[], recurring_id?, installment_group_id?, parcela_n, parcelas_total, anexo_url)
- `recurring_transactions` (regra RRULE, próxima ocorrência)
- `budgets` (category_id, mes, valor_limite)
- `financial_goals` (nome, valor_alvo, valor_atual, data_alvo, account_id)
- `debts` (credor, valor_total, taxa_juros, parcelas)
- `import_rules` (padrao_texto → category_id)

**Transversais**
- `habits` / `habit_logs`
- `goals` (área, métrica, alvo, prazo, origem_automatica)
- `journal_entries`
- `dashboard_widgets` (tipo, posição, config)

Índices: `(user_id, data)` em toda tabela de série temporal; GIN em `search_vector` e nos campos `tags[]`.

---

## 5. Design

- **Dark-first** com light mode; tokens em CSS variables, tema trocado por `data-theme`.
- Base neutra (zinc/slate) + **uma cor de destaque por módulo**: Saúde = esmeralda, Faculdade = índigo, Cursos = violeta, Financeiro = âmbar. Deixa a navegação óbvia sem poluir.
- Tipografia: **Inter** ou **Geist**, com numeral tabular nos valores — números que não "dançam" ao atualizar.
- Cards com borda de 1px sutil, raio 12–16px, sombra quase inexistente. Nada de skeuomorfismo nem glassmorphism pesado.
- Densidade de informação alta no desktop (bento grid) e **mobile-first nos formulários de registro** — é no celular que você vai lançar peso, treino e gasto.
- Micro-animações só onde comunicam algo (número subindo, barra preenchendo). CSS puro > Framer Motion na maioria dos casos.
- **Performance**: code splitting por rota, Recharts e editor carregados sob demanda, virtualização em listas longas, meta de bundle inicial < 150 kb gzip.
- Acessibilidade: contraste AA, foco visível, navegação por teclado (o Ctrl+K depende disso).

---

## 6. Roadmap

**Fase 0 — Fundação (1 semana)**
Monorepo, Vite + React + TS + Tailwind + shadcn, Supabase (auth + RLS + migrations), layout base (sidebar, tema, rotas) e deploy no Render funcionando ponta a ponta. *Deploy antes de ter features — assim o deploy nunca vira um bicho de sete cabeças.*

**Fase 1 — Saúde + Alimentação**
Atividades, sessões, medidas, gráfico de peso com média móvel, calculadora TMB/TDEE, plano de emagrecimento, diário alimentar com TACO + Open Food Facts.

**Fase 2 — Financeiro**
Contas, transações, cartão com fatura por competência, categorias, orçamentos, relatórios, metas.

**Fase 3 — Faculdade e Cursos**
Cursos/grade/semestres, notas e faltas, anotações com editor e busca, progresso e "o que falta", cursos externos.

**Fase 4 — Cola tudo**
Dashboard configurável, command palette, hábitos, calendário unificado, insights cross-módulo, PWA + notificações.

**Fase 5 — Refino**
Import OFX, flashcards com SRS, bot no Telegram, export/backup, investimentos.

---

## 7. Decisões tomadas

1. **TypeScript.**
2. **Só Supabase por enquanto** — sem API no Render. Por isso o projeto é um pacote único em vez
   do monorepo descrito acima; ele vira monorepo quando `apps/api` fizer falta (cron das
   recorrentes e import de OFX, na Fase 2).
3. **Primeiro módulo: Saúde + Alimentação.**

## 8. Status

**Fase 0 — concluída.** Vite + React + TS + Tailwind v4, design system próprio em tokens,
tema claro/escuro, PWA, rotas em lazy loading (bundle inicial ~108 kB gzip), `render.yaml`
pronto para Static Site.

**Fase 1 — concluída.**
- Perfil, atividades com catálogo MET, sessões de treino, medidas corporais, métricas diárias
- Plano de emagrecimento com travas de segurança e recalibração adaptativa
- Diário alimentar com base TACO
- Registro rápido em linguagem natural (Ctrl+K)
- 35 testes unitários cobrindo as fórmulas, o plano e o parser
- Migração SQL com RLS em `supabase/migrations/0001_health.sql`

**Faculdade, Cursos e Caderno — concluídos** (trazidos à frente do Financeiro).
- Instituições e cursos múltiplos, grade curricular com pré-requisitos e progresso por carga
  horária, CR ponderado por créditos, previsão de conclusão pelo ritmo
- Semestre atual: controle de faltas no limite de 25%, avaliações com peso e simulador de nota
- Cursos livres com aulas por módulo, cadastro em lote, ritmo necessário e próxima aula
- Caderno em Markdown compartilhado pelos dois módulos, com etiquetas, busca e salvamento
  automático
- Migração `supabase/migrations/0002_education.sql`, com busca full-text em português
- 54 testes no total

**Pendente na Fase 1.1:** tela de login (Supabase Auth) — hoje o app roda no adaptador local
quando não há `.env` configurado.

**Próxima:** Financeiro.
