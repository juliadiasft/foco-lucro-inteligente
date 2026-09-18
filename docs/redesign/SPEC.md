# Central do Comerciante — Especificação para implementação

Documento para ser lido junto com as 33 telas em `/telas`. Cada tela tem um código (M01, N03, S07…) que aparece no nome do arquivo e é citado aqui. Onde este documento e a tela divergirem, vale este documento — a tela é a referência visual, não a fonte da verdade de regra.

Escrito em 18/09/2026, a partir do app em produção (`central-do-comerciante.onrender.com`), da landing page e das decisões tomadas durante o desenho.

---

## 1. O que o produto é

Sistema de inteligência de lucro para comércio de bairro — mercearia, pet shop, adega, mercado. Não é ERP e não é PDV. A frase que define o escopo: **mostra onde o comerciante perde dinheiro e o que fazer sobre isso.**

Dois lados, uma plataforma:

- **Comerciante** (pago): cadastra produtos e notas de compra, vê margem real por item, recebe oportunidades de lucro ordenadas por R$, compara fornecedores com preço normalizado, negocia e pede.
- **Fornecedor** (grátis): tem vitrine pública indexável, recebe orçamentos dos comerciantes da região, responde e vende direto.

O diferencial defensável não é o cadastro de produtos — é o **cruzamento entre o custo real que o comerciante pagou (nota) e o melhor preço disponível na região (oferta)**. Sem os dois lados, o produto vira um relatório de margem qualquer.

---

## 2. Regras inegociáveis

Estas cinco regras condicionam quase todo o resto. Se alguma cair, o produto muda de natureza.

### 2.1 Preço normalizado é o que torna a comparação possível

R$ 26,90 e R$ 22,80 só são comparáveis se os dois forem convertidos para a mesma unidade base.

```
preco_normalizado = preco / conteudo_liquido
```

Por isso `produto.conteudo_liquido` e `produto.unidade_base` são obrigatórios, e a tela de cadastro (M12) foi desenhada em volta desse campo, com uma explicação na própria tela. Produto sem conteúdo líquido não entra na comparação — a UI deve dizer isso no momento do cadastro, não depois.

### 2.2 Nada derivado é editável

`estoque`, `margem_snapshot`, `indice_saude` e `oportunidade` são escritos **apenas** por job. A fonte da verdade é `compra` + `item_compra` + `movimento_estoque`. Nenhuma tela grava nessas tabelas.

### 2.3 Preço de fornecedor não é público

A vitrine (S01) é pública e indexável — nome, marca, embalagem, prazo de entrega, pedido mínimo, nicho. **Valores, não.** Preço só para conta de comerciante verificada (S05).

Isso é **política de leitura no banco, por `conta.tipo`**, não condicional de componente. Se ficar no front, a primeira chamada de API devolve a tabela inteira.

- Fornecedor nunca lê `oferta` de outro fornecedor. Em nenhuma tela, em nenhum endpoint, em nenhum contexto de IA.
- O contexto que vai para o prompt do assistente do fornecedor passa pelo mesmo filtro.

**Buraco conhecido:** um fornecedor pode abrir conta de comerciante. Mitigação em três camadas — `conta.verificada_em` (CNPJ + nicho batendo), limite de consultas de preço em conta nova, e log de todo acesso a preço em `evento_vitrine` para detectar varredura. Não fecha 100%; encarece o suficiente.

### 2.4 A IA não inventa número

O assistente lê `margem_snapshot`, `oferta`, `estoque` e `compra`, e grava em `consulta_ia.contexto` os IDs que usou. É isso que sustenta o botão "ver como calculei" (M07). Resposta sem ID rastreável é bug, não estilo.

### 2.5 Sem PDV, venda é declarada ou estimada

Integração com PDV **não existe** e não está no escopo imediato. Portanto `venda.origem ∈ (manual, pdv, estimada)` e `venda.confianca ∈ (alta, estimada)`. Toda tela que mostra margem realizada precisa poder dizer "estimado". Margem realizada sem venda real é chute com casa decimal — e o produto perde credibilidade no primeiro mês se apresentar isso como fato.

---

## 3. Modelo de dados

29 tabelas. Convenção: `id` uuid PK em todas, `criado_em`/`atualizado_em` timestamptz em todas, `conta_id` em tudo que é multi-tenant.

### 3.1 Identidade e plano

**`conta`** — comerciante e fornecedor são o mesmo tipo de linha
| campo | tipo | nota |
|---|---|---|
| `tipo` | enum | `comerciante` \| `fornecedor` |
| `razao_social`, `nome_fantasia` | text | |
| `documento` | text UNIQUE | CPF ou CNPJ |
| `nicho_id` | FK nicho | |
| `cidade`, `uf` | text | |
| `telefone`, `email` | text | |
| `verificada_em` | timestamptz | null = não verificada; gate de acesso a preço |

Uma conta que compra e vende não precisa de segunda conta — `tipo` pode virar array se isso aparecer na prática, mas comece com enum.

**`usuario`** — `conta_id`, `nome`, `email` UNIQUE, `senha_hash`, `papel ∈ (dono, gerente, operador)`, `ultimo_acesso`

**`assinatura`** — `conta_id`, `plano ∈ (essencial, profissional, premium)`, `status ∈ (trial, ativa, inadimplente, cancelada)`, `trial_fim`, `renova_em`, `gateway` (cakto), `gateway_id`, `limite_produtos`, `limite_usuarios`, `limite_perguntas_ia`

**`nicho`** — `nome` (mercearia, pet shop, adega, mercado de bairro…)

**`ativacao`** — PK `conta_id`. `produtos_cadastrados`, `primeira_nota_em`, `primeiro_orcamento_em`, `primeira_oportunidade_em`, `concluida_em`. É o checklist da N01 **e** a métrica que diz se o produto pegou.

### 3.2 Catálogo

**`produto`** — pertence ao comerciante
| campo | nota |
|---|---|
| `conta_id` | FK |
| `nome`, `marca` | |
| `categoria_id` | FK |
| `gtin` | código de barras; é o que casa catálogos entre contas |
| `unidade_base` | enum `kg` \| `L` \| `un` |
| `conteudo_liquido` | numeric — 0.9 para 900 ml. **Obrigatório** |
| `embalagem_qtd` | unidades por caixa |
| `preco_venda` | numeric |
| `ativo` | bool |

**`categoria`** — `conta_id`, `nome`, `margem_alvo_pct` (default 18), `imposto_pct`, `perda_pct`

**`fornecedor`** — `conta_id` (quem cadastrou), `conta_fornecedor_id` (FK nullable, se for fornecedor da plataforma), `nome`, `cidade`, `uf`, `distancia_km`, `pedido_minimo`, `frete_gratis_acima`, `prazo_entrega_dias`, **`prazo_pagamento_dias`**, `ativo`

`prazo_pagamento_dias` importa mais do que parece — ver §5.3.

**`oferta`** — preço de um produto em um fornecedor. O coração do produto.
| campo | nota |
|---|---|
| `fornecedor_id`, `produto_id` | UNIQUE juntos |
| `preco` | por unidade de venda |
| `preco_normalizado` | derivado, por kg/L/un |
| `embalagem_qtd`, `pedido_minimo_cx` | |
| `disponivel`, `validade_ate` | |
| `visibilidade` | enum `publica` \| `comerciante_verificado` \| `sob_orcamento` — **default `comerciante_verificado`** |
| `fonte` | `manual` \| `vitrine` \| `nota` \| `ocr` |
| `atualizado_em` | alimenta o ranking do fornecedor |

**`historico_preco`** — `oferta_id`, `preco`, `variacao_pct`, `registrado_em`

**`vitrine`** — PK `conta_id`. `slug` UNIQUE (indexável), `descricao`, `publica`, `visualizacoes`

**`evento_vitrine`** — `conta_fornecedor_id`, `tipo ∈ (visita, busca, contato, acesso_preco)`, `origem ∈ (google, interno)`, `conta_origem_id` nullable, `ocorrido_em`. Serve de analytics **e** de trilha antifraude.

### 3.3 Transação

**`compra`** (nota de entrada) — `conta_id`, `fornecedor_id`, `numero_nf`, `chave_nfe`, `emitida_em`, `total`, `origem ∈ (xml, foto, manual)`

**`item_compra`** — `compra_id`, `produto_id`, `quantidade`, `preco_unitario`, `desconto`, `total`

**`orcamento`** — (era "cotação" na LP; o app já diz Orçamentos, mantenha essa palavra)
`conta_id`, `fornecedor_id`, `status ∈ (rascunho, enviado, respondido, expirado, fechado, cancelado)`, `enviado_em`, `validade`, `total_pedido`, `total_respondido`

**`item_orcamento`** — `orcamento_id`, `produto_id`, `quantidade`, `preco_pedido`, `preco_respondido`, `disponivel`

**`pedido`** — `conta_id`, `fornecedor_id`, `orcamento_id` nullable, `status ∈ (aberto, confirmado, em_transito, recebido, cancelado)`, `total`, `frete`, `previsao_entrega`

**`item_pedido`** — `pedido_id`, `produto_id`, `quantidade`, `preco_unitario`

**`movimento_estoque`** — `conta_id`, `produto_id`, `tipo ∈ (entrada, venda, ajuste, perda)`, `quantidade`, `custo_unitario`, `saldo_apos`, `ocorrido_em`, `origem_id`

**`venda`** — `conta_id`, `ocorrida_em`, `total`, `origem ∈ (manual, pdv, estimada)`, `confianca ∈ (alta, estimada)`

**`item_venda`** — `venda_id`, `produto_id`, `quantidade`, `preco_unitario`, `custo_no_momento` (congelado — não recalcule depois)

**`conta_pagar`** — `conta_id`, `pedido_id` nullable, `fornecedor_id` nullable, `descricao`, `valor`, `vence_em`, `pago_em`, `forma ∈ (boleto, pix, prazo)`, `recorrente`, `status ∈ (aberta, paga, vencida)`

**`conversa`** — `conta_comerciante_id`, `conta_fornecedor_id`, `orcamento_id` nullable, `ultima_mensagem_em`, `nao_lidas_comerciante`, `nao_lidas_fornecedor`

**`mensagem`** — `conversa_id`, `autor_conta_id`, `corpo`, `anexo_tipo ∈ (orcamento, pedido, arquivo)`, `anexo_id`, `lida_em`

### 3.4 Derivado (escrito só por job)

**`estoque`** — PK `produto_id`. `quantidade`, `custo_medio`, `giro_semanal`, `dias_cobertura`, `ultima_venda_em`, `status ∈ (ok, acabando, ruptura, parado)`

**`margem_snapshot`** — `conta_id`, `produto_id`, `data`, `custo_medio`, `preco_venda`, `imposto_pct`, `perda_pct`, `margem_pct`, `lucro_unitario`, `base_venda ∈ (real, estimada)`

**`indice_saude`** — `conta_id`, `data`, `score` (0–100), `comp_margem`, `comp_custo`, `comp_giro`, `variacao_mes`

**`oportunidade`**
| campo | nota |
|---|---|
| `conta_id` | |
| `tipo` | `troca_fornecedor` \| `margem_baixa` \| `estoque_parado` \| `queda_preco` \| `ruptura` |
| `produto_id`, `fornecedor_alvo_id` | nullable |
| `impacto_mensal` | numeric — **ordena a fila em toda tela** |
| `titulo`, `detalhe` | jsonb |
| `status` | `aberta` \| `aplicada` \| `descartada` \| `expirada` |
| `detectada_em`, `aplicada_em` | |

Guardar como linha (em vez de calcular na hora) é o que permite somar o "já recuperado" — `status = aplicada` soma `impacto_mensal`. Esse número é o argumento de renovação no mês 2.

**`fornecedor_score`** — PK `conta_fornecedor_id`. `taxa_resposta`, `tempo_medio_resposta_min`, `pct_precos_atualizados`, `pct_estoque_confiavel`, `score`, `posicao_nicho`, `calculado_em`

**`consulta_ia`** — `conta_id`, `usuario_id`, `pergunta`, `resposta`, `contexto` jsonb (IDs lidos), `tokens`, `custo`, `mes_referencia` (conta a cota)

**`filtro_salvo`** — `conta_id`, `usuario_id`, `escopo ∈ (onde_comprar, catalogo, orcamentos, vitrine)`, `criterios` jsonb, `padrao` bool

**`notificacao`** — `conta_id`, `tipo`, `titulo`, `corpo`, `lida`, `oportunidade_id` nullable

---

## 4. Máquinas de estado

**Orçamento:** `rascunho → enviado → respondido → fechado` (vira pedido). Saídas laterais: `expirado`, `cancelado`.

**Pedido:** `aberto → confirmado → em_transito → recebido`. Saída lateral: `cancelado`.

`recebido` gera `movimento_estoque` de entrada e dispara recálculo do `custo_medio`. É o único caminho que fecha o ciclo sem nota fiscal.

**Oportunidade:** `aberta → em_verificacao → confirmada` · `aberta → descartada` (não reaparece por 90 dias) · `aberta → expirada` (preço mudou, detector reavalia) · `em_verificacao → aberta` (a nota desmentiu).

O estado intermediário é deliberado e é o que torna o "já recuperado" defensável — ver §4.1.

### 4.1 Verificação de oportunidade aplicada

O número "já recuperado R$ 3.820/mês" aparece em quatro telas e é o argumento de renovação no mês 2. Se ele for a soma do que o comerciante *disse* que fez, vira ficção em dois meses e o produto perde a única prova de valor que tem.

O ciclo desenhado (A01 → A02 → A03):

1. **A01** mostra a conta aberta — diferença por unidade, volume mensal médio das 6 últimas notas, e o conflito de prazo de pagamento quando existir. Três saídas: pedir orçamento, "já troquei por fora", descartar.
2. Ao aplicar, a oportunidade vai para `em_verificacao`, **não** para `aplicada`. O valor aparece separado, rotulado "em verificação".
3. **A próxima `compra` daquele produto decide.** Se o `item_compra.preco_unitario` for menor ou igual ao preço-alvo, status vira `confirmada` e o `impacto_confirmado` entra no recuperado. Se vier acima, volta para `aberta` com notificação.
4. **A03** mostra o extrato: confirmadas, em verificação, reabertas e ainda na mesa. Um item reaberto aparece na lista com o motivo ("a nota veio a R$ 1,99") — isso constrói mais confiança que escondê-lo.

Campos adicionais em `oportunidade`: `preco_alvo` (o valor que a nota precisa bater), `impacto_confirmado`, `verificada_em`, `reaberta_em`, `reabertura_motivo`.

Para tipos que não passam por nota — `margem_baixa` confirma quando `produto.preco_venda` muda para o valor sugerido; `estoque_parado` confirma quando o `movimento_estoque` de venda zera o saldo.

---

## 5. Jobs e cálculos

Rodam diariamente, de madrugada, na ordem abaixo. Cada um é idempotente.

### 5.1 Custo e estoque

```
custo_medio     = média ponderada móvel dos item_compra dos últimos 90 dias
giro_semanal    = média de movimento_estoque tipo=venda das últimas 8 semanas
dias_cobertura  = quantidade / (giro_semanal / 7)

status do estoque:
  quantidade = 0                         → ruptura
  dias_cobertura < 7                     → acabando
  sem venda há 60 dias e quantidade > 0  → parado
  senão                                  → ok
```

### 5.2 Margem

```
margem_pct = (preco_venda - custo_medio - imposto - perda) / preco_venda
```

`imposto` e `perda` vêm de `categoria.imposto_pct` / `perda_pct`. Se `venda` do período for `origem = estimada`, grave `margem_snapshot.base_venda = 'estimada'` e a UI mostra o rótulo.

### 5.3 Oportunidades — os 5 detectores

| tipo | dispara quando | impacto_mensal |
|---|---|---|
| `troca_fornecedor` | existe `oferta.preco_normalizado` menor que o `custo_medio` atual | `(custo_atual − melhor_preco) × consumo_mensal` |
| `margem_baixa` | `margem_pct < categoria.margem_alvo_pct` | `(margem_alvo − margem_atual) × preco_venda × giro_mensal` |
| `estoque_parado` | sem venda há 60 dias e saldo > 0 | valor imobilizado (não é ganho — exiba como "travado") |
| `queda_preco` | `historico_preco` caiu > 5% em 30 dias | `(preco_anterior − preco_novo) × consumo_mensal` |
| `ruptura` | saldo = 0 em item com `giro_semanal > 0` | `margem_unitaria × giro_semanal × semanas_previstas` |

**Ajuste importante no `troca_fornecedor`:** o detector precisa considerar `fornecedor.prazo_pagamento_dias`. Com contas a pagar no sistema, "o mais barato" deixa de ser resposta automática — 28 dias a R$ 26,90 pode ganhar de 7 dias a R$ 22,80 numa semana apertada. Sugestão: calcular o impacto em dinheiro e sinalizar o conflito de prazo na própria oportunidade, deixando a escolha com o comerciante.

### 5.4 Índice de saúde do lucro

```
score = 0,40 × comp_margem + 0,35 × comp_custo + 0,25 × comp_giro
```
Cada componente normalizado em 0–100. `comp_custo` mede a distância entre o que a loja paga e o melhor preço disponível na região.

### 5.5 Score do fornecedor

```
score = 0,35 × taxa_resposta
      + 0,25 × pontualidade_resposta   (baseada em tempo_medio_resposta_min)
      + 0,25 × pct_precos_atualizados  (preço com < 30 dias)
      + 0,15 × pct_estoque_confiavel   (respondeu "tenho" e entregou)
```

`posicao_nicho` é o rank dentro de nicho + região. O score decide a ordem em que os fornecedores aparecem na busca do comerciante (N03).

**Regra de produto:** posição não se compra. Isso está escrito na tela (S07) e precisa continuar verdade — é o que dá legitimidade ao ranking e o que faz o fornecedor responder rápido.

---

## 6. Navegação

### 6.1 App do comerciante — 5 abas, sem gaveta

| aba | contém |
|---|---|
| **Painel** | N01 (dia 1) · M01 (índice) · M02 (oportunidades) |
| **Comprar** | N03 (onde comprar) · M08 (fornecedores) · M09 (orçamento) · N05 (pedidos) · N04 (conversas) |
| **Produtos** | M05 (lista) · M04 (detalhe) · M03 (comparar) · M06 (estoque) · M12 (novo produto) |
| **Assistente** | M07 (assistente de lucro) |
| **Mais** | N07 (menu) · N06 (contas a pagar) · M11 (relatórios) · N02 (trazer dados) · M10 (conta e plano) |

O que mudou em relação ao app atual, e por quê:

1. **A gaveta de 11 itens sai.** Hoje o produto mora num menu hambúrguer. Produtos, Fornecedores, Relatórios e Assistente de Lucro estão escondidos.
2. **Assistente vira aba fixa.** É o que separa o Essencial do Profissional. Não pode ser o último item de um menu oculto, e a cota tem que estar visível.
3. **"Comprar" e "Onde comprar" viram uma coisa só.** Hoje são o mesmo módulo com dois nomes em dois lugares.
4. **Comprar absorve o fluxo inteiro** — buscar, orçar, negociar, pedir. Hoje está espalhado em quatro entradas.

### 6.2 App do fornecedor — 5 abas

| aba | contém |
|---|---|
| **Painel** | S02 (orçamentos abertos + vitrine) · S07 (posição na busca) |
| **Orçamentos** | S06 (filtro) · S03 (responder) |
| **Catálogo** | S04 |
| **Conversas** | reaproveita o componente de N04 |
| **Mais** | conta, vitrine, dados |

S01 (vitrine pública) e S05 (vitrine logada) são páginas web, não telas de app.

### 6.3 Nomenclatura a padronizar

- **Assistente de Lucro** em todo lugar. Hoje é "Consultor" na LP e nos planos, "Assistente" no app e na página de contato. Corrija a LP, não o app — o nome que o usuário lê na tela deve ganhar.
- **Orçamento**, não cotação.
- `/inicio` está no menu da LP e responde **404**.

---

## 7. Estados vazios e ativação

O painel atual abre com `R$ 0,00` em corpo grande e manda "conectar seu sistema" — que é a única coisa que ainda não existe. Quem entra no teste de 7 dias bate nessa parede no primeiro minuto.

**N01 substitui isso por:**

1. Barra de ativação com 3 passos (`ativacao`), começando em 1 de 3.
2. Passo 2 é cadastrar 5 produtos — com o motivo explícito: "sem 5 produtos a Central não tem o que comparar".
3. Passo 3 é lançar a última nota — "é dela que sai o seu custo real".
4. CTA primário: cadastrar pela câmera.
5. **Comparar preços promovido**, porque é o único módulo que entrega valor com zero dado cadastrado, e é o diferencial do produto.

`venda` e `meta_mensal` continuam no painel, mas deixam de ser o herói da tela no dia 1.

**N02 (Trazer meus dados)** transforma um item que promete o que não existe em instrumento de pesquisa:

- Topo: o que funciona hoje (XML da nota, câmera).
- Abaixo: "Integração com PDV — em construção", honestamente.
- Pergunta qual sistema o comerciante usa → grava em `interesse_integracao` (`conta_id`, `sistema`, `quer_aviso`). Em duas semanas você sabe qual integração construir primeiro em vez de chutar.

---

## 8. Filtros

Mesmo componente, mesma tabela `filtro_salvo`, quatro escopos com critérios diferentes.

| escopo | critérios |
|---|---|
| `onde_comprar` (N08) | distância, prazo de entrega, pedido mínimo, frete grátis no meu volume, tem em estoque, já comprei, aceita prazo de 28 dias |
| `vitrine` (S05) | categoria, marca, embalagem, disponibilidade |
| `catalogo` (S04) | categoria, preço desatualizado, sem estoque |
| `orcamentos` (S06) | distância, valor estimado, nicho do comerciante, só o que tenho em estoque, só clientes recorrentes |

**O filtro do fornecedor tem efeito comercial e a tela precisa dizer isso.** Um fornecedor que esconde orçamento pequeno responde menos, e responder menos derruba `taxa_resposta`, que derruba `score`, que derruba a posição na busca. A S06 mostra ao vivo quanto o filtro esconde ("6 dos 9 deste mês, R$ 5.240") e o efeito na taxa (64% → 33%), com o limiar explícito de 60%. Filtrar em silêncio faz o fornecedor se esconder sozinho e culpar a plataforma.

---

## 9. Planos e limites

| | Essencial R$ 79,90 | Profissional R$ 129,90 | Premium R$ 179,90 |
|---|---|---|---|
| usuários | 1 | 3 | 5 |
| produtos | 50 | 150 | ilimitado |
| custos, preços, margens | ✓ | ✓ | ✓ |
| estoque e alertas | ✓ | ✓ | ✓ |
| encontrar fornecedor, conversar, pedir | ✓ | ✓ | ✓ |
| comparação entre fornecedores | — | ✓ | ✓ |
| Assistente de Lucro | — | 150 perguntas/mês | 300 perguntas/mês |
| suporte prioritário | — | — | ✓ |

Trial de 7 dias no Profissional, sem cartão. Pagamento via Cakto. Fornecedor é grátis.

**Checagem de limite acontece na escrita:**
- `produto` conta contra `assinatura.limite_produtos`
- `consulta_ia` conta contra `limite_perguntas_ia` por `mes_referencia`
- `usuario` conta contra `limite_usuarios`

A UI mostra o consumo **antes** de estourar (M10, N07) — "você chega no limite em ~3 semanas" é mais útil que um bloqueio surpresa.

---

## 10. Design

- Tema escuro, base navy derivada da marca (`#12304a`).
- `--bg #08111E` · `--surface #0F1E31` · `--surface-2 #16283F`
- Acento único de ação: `--acc #3EE49B`. Cor só aparece quando significa dinheiro ganho, perdido ou em risco.
- Estados: `--warn #FFC24B` · `--neg #FF7E6E` · `--info #74A9FF` · `--vio #B69BFF` (reservado para IA)
- Texto: `--ink #EFF4F9` · `--ink2 #9AACC0` · `--ink3 #63788F`
- Inter. Tracking negativo nos títulos (−0,03em), `font-variant-numeric: tabular-nums` em todo número.
- Raio 18px em card, 13px em input, 12px em botão pequeno.
- Bordas quase invisíveis (`rgba(255,255,255,.075)`) — a separação vem da superfície, não da linha.
- Frame de referência: 390 × 844. Tudo mobile-first.

---

## 11. As cinco bifurcações — recomendação para cada

Estas cinco mudam código. Abaixo, a recomendação e o motivo. Nenhuma está fechada até a Julia confirmar; as duas primeiras precisam estar fechadas antes do passo 3 do §12.

### 11.1 De onde vem a venda — **recomendo estimar, com manual opcional**

Lançamento manual diário em mercearia não acontece. Quem está no balcão não vai registrar venda no celular, e um dado que só metade das lojas preenche é pior que nenhum, porque contamina a comparação entre clientes.

Recomendação: `venda.origem = estimada` como padrão, derivando giro da frequência e do volume das notas de compra (se a loja repõe 198 un/mês de arroz, ela vende ~198 un/mês). `origem = manual` fica disponível para quem quiser precisão pontual.

O que isso custa: margem realizada vira aproximação. Aceitável, porque **a promessa do produto depende do lado da compra, não do da venda** — custo real, preço de fornecedor e oportunidade de troca saem todos da nota. Só giro e margem realizada dependem de venda, e para esses "estimado" é honesto e suficiente.

Obrigatório junto: `venda.confianca = estimada` visível na UI sempre que o número for derivado. Nunca apresentar estimativa como fato.

### 11.2 Verificação de CNPJ — **recomendo automática, reaproveitando o que já existe**

A página de cadastro já faz consulta de CNPJ ("Digite um CNPJ e eu preencho empresa, cidade e nicho para você"). A verificação é praticamente de graça: use a mesma consulta e grave `conta.verificada_em` quando o CNPJ existir, estiver ativo e o nicho for compatível com o declarado.

Sem atrito novo no cadastro, e é o que sustenta o §2.3 — preço só para comerciante verificado. Verificação manual só como fallback para quem cair fora da regra.

### 11.3 Multi-loja — **recomendo não construir agora**

Os planos vão até 5 usuários e 150 produtos: o ICP é loja única. Construir hierarquia de loja agora custa em toda query e não serve ninguém que está pagando.

Mas evite fechar a porta: não crie chaves compostas nem unique constraints que assumam uma loja por conta (`UNIQUE(conta_id, gtin)` em `produto`, por exemplo, vira dívida). Reavalie se aparecer nos primeiros 50 clientes.

### 11.4 Comissão — **recomendo não cobrar do fornecedor por pedido**

Três motivos, em ordem de peso:

1. **Conflita com o ranking.** "Posição não se compra" (§5.5) é o que faz o fornecedor responder em 2h. Um take rate cria pressão permanente para o fornecedor sair da plataforma na segunda compra, e para a plataforma favorecer quem paga.
2. **Não é verificável.** Você não consegue provar que o pedido aconteceu se ele for fechado por fora — e ele vai ser, se houver comissão.
3. **A receita já existe.** O comerciante paga assinatura. O fornecedor grátis é aquisição de oferta, que é o que torna a comparação possível.

Se quiser receita do lado do fornecedor depois, o caminho é plano pago com mais itens de catálogo e analytics da vitrine — não percentual sobre pedido.

### 11.5 Faixa pública de preço — **recomendo manter escondido e medir**

Mantenha o §2.3 como está por 60 dias. O SEO da vitrine não depende de preço: nome do fornecedor, marcas, categorias, cidade e prazo já são conteúdo indexável suficiente para busca do tipo "distribuidora de mercearia em Campinas".

Se o tráfego orgânico não vier, a próxima tentativa é página de categoria por região — não faixa de preço, que devolve referência de mercado ao concorrente por um ganho de SEO incerto.

---

## 12. Ordem sugerida de implementação

Do que sustenta tudo para o que é vitrine.

1. `conta`, `usuario`, `assinatura`, `nicho`, `categoria` — e a política de leitura por `conta.tipo` desde o primeiro endpoint.
2. `produto` com `conteudo_liquido` obrigatório + M12 (cadastro) + importação de XML.
3. `compra`, `item_compra`, `movimento_estoque` → job de `custo_medio` e `estoque`.
4. `margem_snapshot` → M04, M05, M11.
5. `fornecedor`, `oferta`, `historico_preco` com `visibilidade` → M03, N03, S01, S05.
6. `oportunidade` (5 detectores) + `indice_saude` → M01, M02.
7. `orcamento`, `item_orcamento`, `conversa`, `mensagem`, `pedido` → M09, N04, N05, S02, S03.
8. `conta_pagar` → N06 e o ajuste de prazo no detector de troca.
9. `consulta_ia` + Assistente → M07.
10. `fornecedor_score` + ranking → S07, e a ordenação da busca em N03.
11. `filtro_salvo` → N08, S04, S05, S06.

Os passos 1 a 6 já formam um produto vendável: o comerciante vê onde perde dinheiro. Do 7 em diante é o que fecha o ciclo com o fornecedor.

---

## Anexo — índice das telas

**Comerciante**
`N01` painel dia 1 · `N02` trazer meus dados · `N03` onde comprar · `N04` conversa com fornecedor · `N05` pedidos · `N06` contas a pagar · `N07` mais · `N08` filtros de onde comprar
`M01` índice de saúde · `M02` oportunidades · `M03` comparar fornecedores · `M04` produto e margem · `M05` lista de produtos · `M06` estoque · `M07` assistente de lucro · `M08` fornecedores · `M09` orçamento · `M10` conta e plano · `M11` lucro por categoria · `M12` novo produto

**Fornecedor**
`S01` vitrine pública · `S02` painel · `S03` responder orçamento · `S04` catálogo · `S05` vitrine logada · `S06` filtros de orçamentos · `S07` posição na busca · `S08` montar vitrine (onboarding) · `S09` relatórios · `S10` painel no dia 1

**Aplicar oportunidade e notificações**
`A01` oportunidade em detalhe · `A02` aplicada, em verificação · `A03` já recuperado · `A04` central de notificações · `A05` push na tela bloqueada

**Estados de erro, limite e borda**
`X01` limite de produtos · `X02` cota da IA esgotada · `X03` nota importada com pendência · `X04` busca sem resultado · `X05` fim do teste · `X06` sem internet

Regra de push (A05): **só dispara quando há valor em R$ ou ruptura.** Nunca "dê uma olhada no app", nunca resumo semanal genérico, nunca novidade de produto. Três categorias na central (A04) e no push: *precisa de você* (ruptura, orçamento respondido, conta vencendo), *dinheiro na mesa* (queda de preço, nova oportunidade acima de um limiar em R$) e *só para saber* (confirmações, pedido recebido) — esta última nunca vira push.

Quatro regras que valem para todos os estados acima e que aparecem desenhadas neles:

1. **Bloqueio sempre com saída.** X01 não é paywall: oferece arquivar os 8 produtos sem giro antes de oferecer upgrade.
2. **Cota limita a conversa, nunca o valor.** X02 deixa claro que oportunidades, índice e alertas continuam sendo calculados — só o chat para.
3. **Erro de dado é tarefa, não aviso.** X03 mostra os 5 itens com o campo de correção inline, e deixa os 19 bons valendo enquanto isso.
4. **Vazio diz quem é o culpado.** X04 nomeia qual filtro eliminou os fornecedores e oferece soltar exatamente aquele.

Complemento no `fornecedor_score`: `evento_vitrine` com `tipo = busca` precisa gravar **o que foi buscado e não encontrado**, mesmo quando o fornecedor não tem o item. É isso que alimenta o "pediram e você não tinha" (S09) e as buscas da região no dia 1 (S10) — provavelmente o gancho mais forte de retenção do lado do fornecedor, e não custa nada além de gravar a linha.

**Web (referência, não prioridade)**
`D01` painel · `D02` comparar preços · `D03` assistente

**Documentação visual**
`E01` modelagem parte 1 · `E02` modelagem parte 2 · `F01` navegação e fluxos
