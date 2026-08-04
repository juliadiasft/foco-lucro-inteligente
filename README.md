# Central do Comerciante

SaaS próprio para pequenos comércios, sem Lovable e sem Supabase. Inclui cadastro e acesso por empresa, produtos, estoque, fornecedores e cotações, PDV, vendas, relatórios, equipe, planos, cobrança recorrente e um consultor de IA com contexto real do negócio.

## O que está incluído

- Cadastro, login, recuperação de senha e sessões protegidas
- Separação completa dos dados por empresa
- Produtos, categorias, estoque mínimo, reposição e ajustes
- Fornecedores, cotações e comparação do melhor preço
- PDV com baixa de estoque e cálculo de custo, receita e lucro
- Dashboard, meta mensal, indicador de saúde e alertas
- Relatórios por período e exportações CSV
- Equipe com perfis de administrador e operador
- Teste grátis de 14 dias e limites por plano
- Cobrança recorrente, troca e cancelamento pelo Stripe
- Consultor com OpenAI, limite mensal e histórico de perguntas

## Instalação local

Requisitos: Node.js 22, pnpm e PostgreSQL 16.

1. Copie `.env.example` para `.env`.
2. Preencha `DATABASE_URL` e as integrações que deseja ativar.
3. Instale as dependências com `pnpm install`.
4. Crie as tabelas com `pnpm db:migrate`.
5. Inicie com `pnpm dev`.

O endereço local padrão é `http://localhost:3000`.

## Instalação com Docker

1. Copie `.env.example` para `.env`.
2. Adicione também `POSTGRES_PASSWORD` com uma senha longa.
3. Execute `docker compose up -d --build`.

O contêiner espera o banco, aplica as migrações automaticamente e inicia o sistema na porta 3000.

## Chaves necessárias para produção

Configure as chaves diretamente no painel secreto da hospedagem. Não publique nem envie as chaves em conversas, arquivos versionados ou capturas de tela.

- `DATABASE_URL`: banco PostgreSQL de produção
- `APP_URL`: domínio público com HTTPS
- `OPENAI_API_KEY`: ativa o Consultor de Lucro
- `OPENAI_MODEL`: modelo usado pela IA; o padrão é `gpt-5.6`
- `STRIPE_SECRET_KEY`: cobrança recorrente
- `STRIPE_WEBHOOK_SECRET`: assinatura do webhook `/api/stripe-webhook`
- `STRIPE_PRICE_ESSENCIAL`, `STRIPE_PRICE_PROFISSIONAL`, `STRIPE_PRICE_PREMIUM`: IDs dos três preços mensais criados no Stripe
- `RESEND_API_KEY` e `EMAIL_FROM`: recuperação de senha por e-mail

No Stripe, configure o endpoint público `https://SEU-DOMINIO/api/stripe-webhook` para os eventos de checkout e assinatura.

## Privacidade da IA

Quando o usuário pergunta ao Consultor de Lucro, o servidor envia à OpenAI somente o contexto operacional da empresa autenticada necessário para responder: totais de vendas e lucro, produtos e preços, estoque, metas, fornecedores, cotações e a pergunta. Senhas, cartões e dados de outras empresas não são incluídos. As chamadas usam `store: false`.

## Comandos de verificação

- `pnpm build`: gera o pacote de produção
- `pnpm lint`: verifica padrões do código
- `pnpm db:migrate`: aplica migrações pendentes
- `pnpm start`: inicia o pacote já compilado

## Publicação

O sistema pode ser publicado em qualquer hospedagem que aceite Node.js e PostgreSQL ou imagens Docker. Antes de abrir para clientes, configure domínio, e-mail remetente, produtos/preços no Stripe, webhook, backups automáticos do PostgreSQL e monitoramento de disponibilidade.
