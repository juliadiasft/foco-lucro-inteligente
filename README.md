# Central do Comerciante

SaaS próprio para pequenos comércios, sem Lovable e sem Supabase. Inclui cadastro e acesso por empresa, produtos, estoque, fornecedores e cotações, PDV, vendas, relatórios, equipe, planos, cobrança recorrente e um consultor de IA com contexto real do negócio.

O teste grátis é limitado a uma conta por CPF ou CNPJ. O documento é validado no cadastro e somente um hash com segredo e os quatro últimos caracteres são persistidos. Configure `DOCUMENT_HASH_SECRET` com um valor aleatório de pelo menos 32 caracteres e não o altere depois de iniciar os cadastros.

## O que está incluído

- Cadastro, login, recuperação de senha e sessões protegidas
- Separação completa dos dados por empresa
- Produtos, categorias, estoque mínimo, reposição e ajustes
- Fornecedores, cotações e comparação do melhor preço
- PDV com baixa de estoque e cálculo de custo, receita e lucro
- Dashboard, meta mensal, indicador de saúde e alertas
- Relatórios por período e exportações CSV
- Equipe com perfis de administrador e operador
- Teste grátis de 7 dias e limites por plano
- Cobrança recorrente, troca e cancelamento pela Cakto
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
- `OPENAI_MODEL`: modelo usado pela IA; o padrão é `gpt-5.6-luna`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`: ativam os alertas no celular
- `CAKTO_CLIENT_ID` e `CAKTO_CLIENT_SECRET`: acesso servidor-servidor à API da Cakto
- `CAKTO_WEBHOOK_SECRET`: valida os eventos recebidos em `/api/cakto-webhook`
- `CAKTO_CHECKOUT_ESSENCIAL`, `CAKTO_CHECKOUT_PROFISSIONAL`, `CAKTO_CHECKOUT_PREMIUM`: links dos três checkouts mensais da Cakto
- `RESEND_API_KEY` e `EMAIL_FROM`: recuperação de senha por e-mail

Na Cakto, configure o endpoint público `https://SEU-DOMINIO/api/cakto-webhook` para compra aprovada, assinatura criada, renovada, recusada ou cancelada, reembolso e chargeback.

## Privacidade da IA

Quando o usuário pergunta ao Consultor de Lucro, o servidor envia à OpenAI somente o contexto operacional da empresa autenticada necessário para responder: totais de vendas e lucro, produtos e preços, estoque, metas, fornecedores, cotações e a pergunta. Senhas, cartões e dados de outras empresas não são incluídos. As chamadas usam `store: false`.

## Comandos de verificação

- `pnpm build`: gera o pacote de produção
- `pnpm lint`: verifica padrões do código
- `pnpm db:migrate`: aplica migrações pendentes
- `pnpm start`: inicia o pacote já compilado

## Publicação

O sistema pode ser publicado em qualquer hospedagem que aceite Node.js e PostgreSQL ou imagens Docker. Antes de abrir para clientes, configure domínio, e-mail remetente, produtos e ofertas na Cakto, webhook, backups automáticos do PostgreSQL e monitoramento de disponibilidade.
