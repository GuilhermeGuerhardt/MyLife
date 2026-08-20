# Life

Dashboard da vida: saúde, alimentação, faculdade, cursos e finanças em um lugar só.

**Entregue até aqui:** módulos de **Saúde** (atividades, medidas, plano de emagrecimento
adaptativo e diário alimentar), **Faculdade**, **Cursos**, **Caderno** e **Financeiro**, além do
registro rápido em linguagem natural e do PWA instalável. O que ainda falta está em
[docs/PLANO.md](docs/PLANO.md).

---

## Stack

- **React 19 + Vite + TypeScript** — rotas em lazy loading, bundle inicial ~108 kB gzip
- **Tailwind CSS v4** com design system próprio em tokens semânticos (tema claro/escuro)
- **TanStack Query** para estado de servidor, **Recharts** para gráficos (carregado sob demanda)
- **Supabase** (Postgres + Auth + RLS) — opcional: o app roda 100% local sem ele
- **PWA** via vite-plugin-pwa

## Rodando

```bash
npm install && npm run dev
```

Sem `.env`, o app usa um adaptador `localStorage` e funciona por completo offline — útil para
desenvolver antes de existir projeto no Supabase. O indicador no rodapé da sidebar mostra
qual modo está ativo.

Scripts:

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento em http://localhost:5173 |
| `npm run build` | Typecheck + build de produção em `dist/` |
| `npm test` | Testes unitários (fórmulas de saúde, plano, parser, formatação) |
| `npm run typecheck` | Só a checagem de tipos |

## Conectando ao Supabase

1. Crie o projeto no [Supabase](https://supabase.com).
2. Rode a migração `supabase/migrations/0001_health.sql` no SQL Editor (ou via `supabase db push`).
3. Copie `.env.example` para `.env` e preencha:

```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

A anon key é pública por design — quem protege os dados é o **RLS**, e toda tabela da migração
já vem com a policy `user_id = auth.uid()`. Nenhuma linha é visível sem sessão autenticada.

> A tela de login ainda não existe: enquanto o módulo de auth não entra (Fase 1.1), configurar
> o `.env` faz as escritas exigirem um usuário autenticado. Para uso imediato, deixe sem `.env`
> e o modo local cobre tudo. O backup em JSON fica em **Perfil → Exportar backup**.

## Deploy no Render

O `render.yaml` já descreve um Static Site com rewrite de SPA e cache dos assets:

1. Conecte o repositório no Render e escolha **Blueprint** (ele lê o `render.yaml`).
2. Defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em Environment.
3. Deploy. Build: `npm ci && npm run build`, publish: `dist`.

## Estrutura

```
src/
├─ components/         # design system (button, card, field, modal…) e layout
├─ data/               # tipos, adaptadores (local/Supabase), hooks de query, seeds
├─ features/
│  ├─ health/          # composição da lógica de saúde (resumo, gráfico de peso)
│  └─ education/       # formulários de curso/disciplina, cartão do semestre, Markdown
├─ lib/
│  ├─ health/          # TMB, TDEE, IMC, média móvel, plano e recalibração (puro + testado)
│  ├─ education/       # progresso, pré-requisitos, faltas, média e simulador (puro + testado)
│  ├─ finance/         # centavos, ciclo de fatura, parcelas e relatórios (puro + testado)
│  ├─ quick-add/       # interpretador do Ctrl+K
│  ├─ format.ts        # formatação pt-BR
│  └─ supabase.ts
├─ pages/              # uma rota por arquivo
└─ index.css           # tokens de tema
supabase/migrations/   # SQL versionado
```

A regra que mantém o projeto sustentável: **nada de lógica de cálculo dentro de componente**.
As fórmulas vivem em `src/lib` como funções puras com teste, e as telas só as consomem.

## Destaques da Fase 1

**Plano de emagrecimento com travas de segurança.** O plano não obedece cegamente ao prazo
pedido: o ritmo fica entre 0,5% e 1% do peso por semana, o déficit não passa de 25% do gasto
(20% quando não há prazo definido), há piso calórico por sexo e a meta nunca desce abaixo do
IMC 18,5. Quando o pedido é inviável, ele avisa e devolve a data realista.

**Recalibração adaptativa.** A cada duas semanas o app compara a perda real com a projetada
(usando média dos 3 primeiros e 3 últimos registros, para não reagir a ruído) e sugere um
ajuste calórico limitado a ±250 kcal.

**TDEE medido, não declarado.** Se há treinos registrados na semana, o gasto vem deles
(`MET × peso × horas`) em vez de um fator de atividade chutado.

**Média móvel de 7 dias.** O peso exibido é sempre a média, não a pesagem do dia — que oscila
1–2 kg por água e sal.

**Registro rápido (Ctrl+K).** `peso 84,2`, `corri 5km em 28min`, `futvolei 1h30`, `dormi 7h30`,
`agua 500ml`. Regex pura: instantâneo e offline.

## Destaques de Faculdade e Cursos

**Progresso por carga horária, não por contagem.** Uma disciplina de 80 h não vale o mesmo que
uma de 30 h. Horas complementares entram na conta, e disciplinas dispensadas contam carga sem
entrar na média.

**Pré-requisitos de verdade.** Cada disciplina aponta as que precisam vir antes; a tela mostra o
que está bloqueado, o que falta para destravar e o que já dá para cursar no próximo semestre.

**Limite de faltas.** Frequência mínima de 75%, com a resposta que interessa no meio do
semestre: "pode faltar mais 8 de 20", virando alerta quando resta uma e reprovação quando passa.

**Simulador de nota.** Avaliações com peso respondem "preciso de 6,5 na P2 para fechar em 6,0",
avisam quando a aprovação já está garantida e quando não dá mais para alcançar.

**Cadastro de aulas em lote.** Cole o índice do curso — uma aula por linha, numeração é removida
sozinha — em vez de preencher formulário aula por aula.

**Caderno em Markdown**, compartilhado por Faculdade e Cursos: anotação ligada ao curso e à
disciplina, etiquetas, busca em título/conteúdo/etiqueta, prévia renderizada e salvamento
automático. O HTML gerado passa por sanitização antes de ir para a tela.

## Destaques do Financeiro

**Fatura por competência.** Uma compra não pertence ao mês em que foi feita, e sim à fatura que
a inclui: comprar dia 29 com fechamento dia 28 significa pagar só na fatura seguinte. Cada
lançamento carrega uma competência (`AAAA-MM`) calculada a partir do ciclo do cartão, e é por
isso que o "gasto do mês" bate com o extrato. O formulário mostra a fatura de destino antes de
salvar.

**Parcelamento que fecha a conta.** R$ 900 em 7x viram 6 parcelas de R$ 128,57 e uma primeira de
R$ 128,58 — a sobra de centavos fica na primeira, como as operadoras fazem, e a soma devolve o
total exato. Cada parcela cai na sua fatura, e remover uma pergunta se você quer apagar o grupo
inteiro.

**Dinheiro em centavos.** Todo valor é inteiro. Reais em ponto flutuante parecem inofensivos até
somar algumas centenas de lançamentos e o saldo fechar com uns centavos que ninguém explica.

**Categoria adivinhada pela descrição.** "IFOOD *LANCHONETE" cai em Delivery, "Posto Shell" em
Transporte. As mesmas palavras-chave vão servir à importação de OFX.

**Orçamento envelope** por categoria e mês, com alerta em 80% e 100% e cópia dos limites do mês
anterior. **Metas** calculam o aporte mensal necessário para o prazo.

**Registro rápido** também lança: `gastei 35 no mercado` grava a despesa na categoria certa,
`recebi 3500 de salario` grava a receita.

## Aviso

Os cálculos de saúde usam equações populacionais publicadas (Mifflin-St Jeor, fatores de
atividade, valores MET do Compendium of Physical Activities) e são estimativas com margem de
erro individual. **Não substituem nutricionista ou médico.**
