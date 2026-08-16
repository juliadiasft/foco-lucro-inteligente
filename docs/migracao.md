# Roteiro da migração para Oracle + Neon

Ordem de execução, com o ponto exato em que dá para voltar atrás. Nada aqui desliga o Railway antes da nova instalação responder corretamente.

## Antes de tudo

O Railway continua ligado e recebendo tráfego durante os passos 1 a 5. Só o passo 7 muda para onde os clientes vão.

## 1. Contas (você)

- **Neon** — crie o projeto e copie a `DATABASE_URL` de conexão (a versão *pooled*).
- **Oracle Cloud** — crie a conta e uma instância Always Free. A capacidade de ARM varia por região; se não houver, tente outra região antes de desistir.

## 2. Cópia de segurança (antes de qualquer coisa)

```bash
SOURCE_DATABASE_URL="<url do Railway>" node scripts/db-backup.mjs backup-antes-da-migracao.json
```

Guarde o arquivo **fora do Railway e fora da Oracle**. Este é o ponto de retorno se tudo der errado.

Para devolver esse arquivo a um banco vazio:

```bash
DATABASE_URL="<url do banco>" node scripts/db-restore.mjs backup-antes-da-migracao.json
```

## 3. Esquema no Neon

```bash
DATABASE_URL="<url do Neon>" node scripts/migrate.mjs
```

Cria as tabelas a partir das migrações do projeto. O esquema do destino passa a ser exatamente o que o código descreve — não uma fotografia de um estado antigo.

## 4. Cópia dos dados

```bash
SOURCE_DATABASE_URL="<url do Railway>" DATABASE_URL="<url do Neon>" node scripts/db-copy.mjs
```

O script calcula sozinho a ordem das tabelas pelas chaves estrangeiras, copia em lotes e **confere a contagem de cada tabela no final**. Se qualquer tabela divergir, ele avisa e termina com erro — e nesse caso o Railway não deve ser desligado.

O script nunca escreve na origem e nunca apaga nada no destino.

A lógica de cópia, backup e restauração é testada contra dois Postgres de verdade em `scripts/db-copy.test.mjs` — a migração acontece uma vez só e não tem ensaio, então o ensaio fica ali:

```bash
node scripts/db-copy.test.mjs
```

## 5. Aplicação na Oracle

- Instalar Docker na instância.
- Publicar a imagem do projeto (o `Dockerfile` da raiz já serve, sem alteração).
- Configurar as variáveis, todas elas:

`DATABASE_URL` (Neon) · `DATABASE_SSL=true` · `APP_URL` · `SESSION_COOKIE_NAME` · `DOCUMENT_HASH_SECRET` · `OPENAI_API_KEY` · `OPENAI_MODEL` · `CAKTO_CLIENT_ID` · `CAKTO_CLIENT_SECRET` · `CAKTO_WEBHOOK_SECRET` · `CAKTO_CHECKOUT_ESSENCIAL` · `CAKTO_CHECKOUT_PROFISSIONAL` · `CAKTO_CHECKOUT_PREMIUM` · `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT` · `RESEND_API_KEY` · `EMAIL_FROM`

> `DOCUMENT_HASH_SECRET` precisa ser **exatamente o mesmo** do Railway. Se mudar, todas as travas de teste grátis existentes viram órfãs e os documentos podem repetir o teste.

## 6. Conferência antes de virar a chave

Com a nova instalação no ar, ainda sem tráfego:

- `/api/health` responde `{"status":"ok"}`
- Login funciona com uma conta existente
- Painel carrega com os dados certos
- Busca de fornecedores retorna resultado

## 7. Virada

1. Apontar o domínio para a Oracle e configurar HTTPS.
2. **Atualizar a URL do webhook na Cakto.** Se esquecer, pagamento entra e a conta não é liberada — os eventos ficam registrados em `billing_webhook_failures`, visíveis no back office em `/adm/cobranca`, mas o cliente fica sem acesso até alguém resolver na mão.
3. Manter o Railway ligado por alguns dias.

## 8. Voltar atrás

Enquanto o Railway estiver ligado e com o banco intacto, o rollback é apontar o domínio de volta e restaurar a URL do webhook na Cakto. Por isso ele só é desligado depois.

## Limites do plano gratuito

- **Neon: 0,5 GB.** Ao estourar, ele **suspende a escrita em vez de cobrar**. O maior consumidor é `ai_usage`, que guarda pergunta e resposta na íntegra — definir retenção para esse histórico adia bastante o limite.
- **Neon: 100 CU-hours por mês.**
- **Oracle:** a cota gratuita de ARM foi reduzida em 2026 e instâncias ociosas podem ser recuperadas. Backup automático é responsabilidade de quem administra.
