# Life

Dashboard da vida: saúde, alimentação, faculdade, cursos e finanças em um lugar só.

Programa de desktop para Windows. Funciona **inteiramente offline**, sem conta, sem servidor e
sem mensalidade — seus dados ficam na sua máquina.

**Entregue até aqui:** módulos de **Saúde** (atividades, medidas, plano de emagrecimento
adaptativo e diário alimentar), **Faculdade**, **Cursos**, **Caderno**, **Financeiro** e
**Rotina** (hábitos, agenda unificada e insights entre módulos), com dashboard configurável,
registro rápido em linguagem natural e importação de extrato em planilha. O que ainda falta
está em [docs/PLANO.md](docs/PLANO.md).

---

## Usando o app

Esta seção é para quem quer **usar** o Life. Para mexer no código, pule para
[Desenvolvendo](#desenvolvendo).

### O que você precisa

| Requisito | Detalhe |
|---|---|
| **Windows 10 ou 11**, 64 bits | No Windows 10, versão 1803 ou mais nova |
| **WebView2** | Já vem no Windows 11. No Windows 10 mais antigo, baixe o [Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (gratuito, ~2 MB) |
| **~15 MB de disco** | 3 MB o instalador, ~6 MB instalado, o resto é o seu banco crescendo |

**O que você não precisa:** internet, conta de usuário, senha, privilégio de administrador,
Node.js, Rust ou qualquer outra ferramenta. Nada disso é usado em tempo de execução.

### Instalando

1. Baixe `Life_0.2.2_x64-setup.exe`.
2. Execute o arquivo.
3. O Windows provavelmente vai mostrar uma tela azul do **SmartScreen** dizendo que não
   reconhece o programa. Isso acontece porque o executável não tem assinatura digital —
   assiná-lo exige um certificado pago. Clique em **Mais informações → Executar assim mesmo**.
4. O Life aparece no menu Iniciar como qualquer outro programa.

A instalação é **por usuário**: não pede administrador e não escreve em `Program Files`.

### Onde ficam seus dados

Por padrão, num arquivo SQLite em `%APPDATA%\app.life.desktop\life.db`. Cole esse caminho no
Explorador de Arquivos para chegar lá.

Em **Perfil → Pasta de trabalho** você pode trocar para uma pasta do disco à sua escolha, onde
cada tabela vira um `.json` legível. Apontando para dentro do OneDrive ou do Google Drive, seus
dados acompanham você entre computadores — a sincronização é do próprio serviço, sem servidor
no meio.

De qualquer forma, **exporte um backup de vez em quando** em Perfil → Backup. Desinstalar o
programa pode levar o banco junto, e o backup é o que sobrevive a isso.

### Atualizando

Baixe o instalador da versão nova e execute por cima. Seus dados não são tocados: o banco vive
fora da pasta do programa.

---

## Stack

- **Tauri 2** — programa de desktop para Windows. A janela é WebView2 (já vem no
  Windows 11), então o instalador fica na casa dos poucos MB em vez dos ~150 de um Electron
- **React 19 + Vite + TypeScript** — rotas em lazy loading, bundle inicial ~108 kB gzip
- **Tailwind CSS v4** com design system próprio em tokens semânticos (tema claro/escuro)
- **TanStack Query** para estado de servidor, **Recharts** para gráficos (carregado sob demanda)
- **SQLite** via `tauri-plugin-sql` — banco local, sem servidor e sem conta
- **PWA** via vite-plugin-pwa, só no build web — o app segue instalável pelo navegador para quem
  quiser essa via; no build do desktop o plugin é desligado, porque um cache entre o app e ele
  mesmo só cria problema quando os arquivos já estão em disco

## Desenvolvendo

```bash
npm install && npm run dev
```

Isso abre o **programa de desktop**. Exige Rust e as Build Tools da Microsoft
(veja [Pré-requisitos](#pré-requisitos)). Para mexer só na interface, sem o
toolchain nativo, `npm run dev:web` sobe o Vite em `http://localhost:5174` e o
app roda no navegador com o `localStorage` como destino.

### Pré-requisitos

| O quê | Como | Tamanho |
|---|---|---|
| WebView2 | Já vem no Windows 11 | — |
| Rust | `winget install Rustlang.Rustup` | ~200 MB |
| Build Tools MSVC | `winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"` | 3–7 GB |

`npx tauri info` diz o que ainda falta.

### Gerando o instalador

```bash
npm run build
```

Sai em `src-tauri/target/release/bundle/nsis/Life_0.2.2_x64-setup.exe`. O
instalador é NSIS por usuário — não pede administrador e não toca em `Program
Files`.

O indicador no rodapé da barra lateral mostra qual destino de gravação está ativo: **Banco
local**, **Pasta** ou **Navegador**.

### No Windows, sem terminal

Um arquivo na raiz, `Life.cmd`, com menu: atualizar o app, instalar ou remover a
inicialização automática, abrir o log e subir o modo desenvolvimento. Ele mostra o estado
do servidor logo ao abrir, que é o que se quer saber quando algo não funciona.

Eram quatro arquivos antes. Três serviam a ações de uso único ou raro e cada um repetia a
detecção do Node e o `chcp` — um menu com o estado no topo cobre tudo com menos superfície.

**Por que o modo dev usa a porta 5174.** O app instalado vive em `localhost:5173` e, com o
service worker ativo, é o cache quem responde naquela origem. Subir o dev na mesma porta faria
o cache atender no lugar do servidor e as mudanças simplesmente não apareceriam.

`server/` guarda a parte que fica ligada:

- **`static-server.mjs`** — servidor de arquivos em `node:http` puro, sem dependência alguma.
  O app não tem backend: isto só entrega `dist/`, com fallback de rota para o React Router,
  `no-cache` no `sw.js` (senão o app trava numa versão antiga para sempre) e cache de um ano
  nos arquivos com hash no nome. Lê do disco a cada requisição, então gerar o build publica a
  versão nova sem reiniciar nada. Escuta só em `127.0.0.1` — para alcançar do celular,
  `LIFE_HOST=0.0.0.0` e uma regra no firewall.
- **`supervisor.mjs`** — mantém o servidor de pé e o religa se ele cair, com espera que dobra
  a cada queda rápida. Sem essa espera, um erro que mata o servidor no primeiro segundo viraria
  um laço girando o processador e enchendo o log. Porta ocupada três vezes seguidas significa
  que já existe outra instância, e aí o supervisor sai em vez de insistir.
- **`launch-hidden.vbs`** — inicia tudo sem janela. O Agendador até roda tarefa "conectado ou
  não", mas isso exige guardar a senha da conta; estilo de janela 0 resolve sem senha.
- **`install-task.ps1`** — registra a tarefa *ao fazer logon*, sem elevação, com limite de
  execução infinito (o padrão do Windows mata tarefa que passa de três dias) e instância única.

O log fica em `server/life-server.log`.

Scripts:

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento em http://localhost:5173 |
| `npm run build` | Typecheck + build de produção em `dist/` |
| `npm test` | Testes unitários (fórmulas de saúde, plano, parser, formatação) |
| `npm run typecheck` | Só a checagem de tipos |

## Onde os dados ficam

Três destinos possíveis. O app escolhe em tempo de execução e nenhuma tela sabe qual está ativo —
a lógica vive em `src/data/adapters.ts`.

| Modo | Onde grava | Sincroniza entre máquinas |
|---|---|---|
| **Banco local** | SQLite em `%APPDATA%\app.life.desktop\life.db` | Não |
| **Pasta** | Arquivos JSON numa pasta do disco | Pelo Drive/OneDrive, se a pasta estiver lá |
| **Navegador** | `localStorage` (só no `npm run dev:web`) | Não |


### Pasta de trabalho

Em **Perfil → Pasta de trabalho**, escolha uma pasta e o app passa a guardar tudo nela: um arquivo
JSON por tabela, indentado e legível. Aponte para dentro da pasta sincronizada do Google Drive ou
do OneDrive e os dados acompanham você entre computadores, sem servidor e sem conta — a ideia é a
mesma do Obsidian.

**Um arquivo por tabela, não um só.** Gravar um hábito reescreve 2 kB em vez de 2 MB, o Drive
sincroniza só o que mudou (menos conflito), e dá para abrir `transactions.json` e entender o que
tem lá.

**Onde funciona:** Chrome e Edge, no computador. A File System Access API não existe no Firefox,
no Safari nem em navegador de celular — por isso o modo pasta é uma opção, nunca o padrão, e o
cartão diz isso na cara quando o navegador não suporta.

**Permissão:** o navegador lembra da pasta entre sessões, mas exige um clique para reconceder a
escrita a cada nova sessão. Pedir permissão sem gesto do usuário é recusado — por isso existe o
botão "Reconectar a última" em vez de uma tentativa silenciosa ao abrir.

Trocar para uma pasta vazia com dados já no navegador pergunta antes se você quer levá-los junto.

## Backup e restauração

Em **Perfil → Dados e sincronização**:

- **Exportar backup** gera um JSON com todas as tabelas. Ele lê pelo adaptador ativo, então
  funciona igual no banco local e na pasta de trabalho.
- **Restaurar backup** lê o arquivo de volta. Antes de gravar, valida o conteúdo e mostra a
  contagem por tabela para conferência.

A restauração deixa o app **igual ao arquivo**: o que está no backup entra, e o que existe e não
está lá é removido. Um import que só somasse faria registros apagados ressuscitarem a cada
restauração — por isso a confirmação é explícita e o botão é vermelho.

O formato é versionado (`app`, `version`, `exported_at`, `tables`), e o import ainda aceita os
backups do formato antigo, sem cabeçalho. Arquivo de outro app, versão futura ou tabela
corrompida são recusados inteiros, em vez de gravados pela metade.

Os dados vivem **nesta máquina** — no banco do aplicativo ou na pasta que você escolheu.
Formatar o computador, ou desinstalar o programa sem cuidado, apaga tudo. Não há servidor
guardando uma cópia: exportar de vez em quando é o que garante levar os dados adiante.

## Estrutura

```
src/
├─ components/         # design system (button, card, field, modal…) e layout
├─ data/               # tipos, adaptadores (SQLite/pasta/local), hooks de query, seeds
├─ features/
│  ├─ health/          # composição da lógica de saúde (resumo, gráfico de peso)
│  └─ education/       # formulários de curso/disciplina, cartão do semestre, Markdown
├─ lib/
│  ├─ health/          # TMB, TDEE, IMC, média móvel, plano e recalibração (puro + testado)
│  ├─ education/       # progresso, pré-requisitos, faltas, média e simulador (puro + testado)
│  ├─ finance/         # centavos, ciclo de fatura, parcelas e relatórios (puro + testado)
│  ├─ habits/          # sequências, meta semanal e heatmap (puro + testado)
│  ├─ calendar/        # agenda unificada e export iCalendar (puro + testado)
│  ├─ insights/        # série semanal, correlação e regras de insight (puro + testado)
│  ├─ quick-add/       # interpretador do Ctrl+K
│  ├─ dates.ts         # aritmética de datas em ISO local
│  ├─ format.ts        # formatação pt-BR
│  └─ salvar-arquivo.ts # salvar backup e .ics, nativo ou no navegador
├─ pages/              # uma rota por arquivo
└─ index.css           # tokens de tema
src-tauri/             # processo nativo: janela, migração SQL e acesso a disco
supabase/migrations/   # SQL versionado, guardado caso a sincronização volte
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
`agua 500ml`, `feito leitura`. Regex pura: instantâneo e offline.

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

**Categoria adivinhada pela descrição.** "DELIVERY *LANCHE" cai em Delivery, "POSTO 24H" em
Transporte. As mesmas palavras-chave servem à importação de planilha.

**Importação de planilha (CSV).** Quem já mantém as contas em outro app não vai redigitar seis
meses de lançamento. O cabeçalho é reconhecido sozinho — e quando não é, dá para apontar coluna
por coluna, então formato desconhecido é trabalho de dois cliques, não pedido de funcionalidade.
Parcela escrita no nome (`Geladeira (5/48)`) vira parcelamento de verdade, com as linhas do mesmo
financiamento no mesmo grupo. A conta e a categoria que o arquivo cita e o app não tem podem ser
criadas na hora. **Deduplicação por data, valor, tipo e descrição**: reimportar o mesmo extrato não
duplica nada, e duas viagens de metrô de R$ 5,40 no mesmo dia continuam sendo dois lançamentos —
a contagem é por ocorrência, não por conjunto. Tudo acontece no navegador; nada é gravado antes da
prévia.

**Orçamento envelope** por categoria e mês, com alerta em 80% e 100% e cópia dos limites do mês
anterior. **Metas** calculam o aporte mensal necessário para o prazo.

**Registro rápido** também lança: `gastei 35 no mercado` grava a despesa na categoria certa,
`recebi 3500 de salario` grava a receita.

## Destaques da Rotina

**O dia de hoje não quebra sequência.** Enquanto o dia não acabou, não dá para dizer que o hábito
falhou: a sequência conta a partir de hoje quando já houve registro e a partir de ontem quando
não. É a diferença entre abrir o app de manhã e ver "12 dias" ou ver "0".

**Hábito semanal se mede em semanas.** "Treinar 4× por semana" não é quebrado por uma terça-feira
sem treino. A sequência conta semanas que bateram a meta, e a semana corrente só entra depois de
batida — antes disso ela fica pendente, não perdida. O cartão avisa quando a meta ainda cabe nos
dias restantes ("faltam 2 em 2 dias") e quando não cabe mais.

**Heatmap clicável.** Seis meses de consistência em uma tira; clicar numa célula corrige o
passado, porque ninguém marca hábito no dia certo por 180 dias seguidos.

**Agenda unificada de verdade.** Um calendário só, com tudo: aulas projetadas da grade semanal,
provas e entregas, treinos registrados, contas a pagar, o vencimento de cada fatura, as recorrentes
previstas, a data-alvo das metas financeiras, o início e o término previsto de cada curso e
graduação, e as duas datas do plano de emagrecimento — a escolhida e a que o ritmo atual promete.
Compra no cartão não vira "conta a pagar" — quem vence é a fatura, e ela aparece com o total do
período certo. A legenda é o filtro: clicar em "Financeiro" tira a área da grade, porque num mês
cheio olhar uma coisa de cada vez é o gesto mais comum. Export `.ics` com horário flutuante: aula
das 19h continua às 19h em qualquer fuso, sem andar no horário de verão.

**Rota que sobrevive a um build novo.** Depois de uma atualização os chunks mudam de nome, e
uma aba aberta desde antes continua executando o bundle antigo — que pede arquivos já apagados.
A casca segue funcionando, porque já está carregada, e **toda página interna dá branco**: é o
`import()` dela que falha. O service worker não resolve sozinho, já que a página em execução não
recarrega por conta própria. `lazyRoute` percebe a falha e se recupera em degraus — recarrega,
depois descarta service worker e caches, e só então mostra uma tela com explicação e um botão.
Duas falhas dentro de vinte segundos param a escada: tela piscando para sempre é pior do que uma
mensagem de erro.

**Insights que sabem calar a boca.** Toda regra passa por três travas antes de virar frase: pelo
menos 3 semanas de cada lado da comparação, efeito de no mínimo 10%, e linguagem descritiva — "nas
semanas em que X, Y foi maior", nunca "X causa Y". A tela vazia com "ainda não dá para afirmar
nada" é o comportamento correto, não uma feature faltando.

**Dashboard configurável.** Onze widgets que podem ser ligados, desligados e reordenados; o banco
guarda só o que foi personalizado, então widget novo aparece com o padrão dele em vez de sumir.

## Aviso

Os cálculos de saúde usam equações populacionais publicadas (Mifflin-St Jeor, fatores de
atividade, valores MET do Compendium of Physical Activities) e são estimativas com margem de
erro individual. **Não substituem nutricionista ou médico.**
