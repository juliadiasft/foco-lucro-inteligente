# Infraestrutura de custo zero

Objetivo: manter o custo de plataforma em zero durante a validação, sem abrir mão de backup e sem perder dados quando os primeiros assinantes chegarem.

O sistema não tem nenhuma dependência do Railway. É um contêiner Docker com Node e um PostgreSQL acessado por `pg`, com SQL direto. Roda em qualquer lugar que aceite imagem Docker e forneça uma `DATABASE_URL`.

## Arquitetura alvo

| Camada | Onde | Custo |
|---|---|---|
| Aplicação | Oracle Cloud Always Free — VM ARM com Docker | Zero, sem prazo de expiração |
| Banco | Neon — plano gratuito, uso comercial permitido | Zero até 0,5 GB |
| Domínio | Registro.br | ~R$ 40/ano |
| IA | OpenAI, por token | Variável |
| Cobrança | Cakto | Percentual por transação |

## Por que não as opções mais óbvias

- **Vercel e Netlify no plano Hobby**: o contrato proíbe uso comercial. No dia em que a Cakto é ligada, o projeto está em violação e pode ser suspenso.
- **Render no plano gratuito**: o PostgreSQL gratuito expira em 30 dias, com 14 dias de carência, e depois os dados são apagados. O serviço web também dorme após 15 minutos de inatividade.
- **Railway**: não possui camada gratuita permanente.

## Por que Neon e não PostgreSQL na própria VM

Colocar o banco na mesma VM elimina o teto de 0,5 GB, mas transfere backup, restauração e atualização de segurança para você — e a VM do Always Free pode ser recuperada pela Oracle quando fica ociosa. O Neon é gerenciado, permite uso comercial no plano gratuito e não expira.

Quando o banco passar de 0,5 GB, o Neon **suspende a escrita em vez de cobrar**. Isso é um aviso, não uma surpresa na fatura. O momento de migrar para o plano pago coincide com o momento em que já existe receita para pagá-lo.

## Limites que vão ser atingidos, e quando

- **0,5 GB de armazenamento.** O maior consumidor é a tabela `ai_usage`, que guarda pergunta e resposta na íntegra. Com 300 assinantes usando a cota mensal, esse volume sozinho ultrapassa o limite em poucos meses. Definir retenção para o histórico de IA adia bastante esse ponto.
- **100 CU-hours por mês.** Com movimento real, isso se esgota antes do fim do mês.
- **Capacidade da Oracle.** A cota gratuita de ARM foi reduzida em 2026 e a disponibilidade varia por região.

## Ordem da migração

1. Criar o projeto no Neon e obter a `DATABASE_URL`.
2. Exportar o banco atual do Railway com `pg_dump` e guardar a cópia fora das duas plataformas.
3. Restaurar no Neon e conferir a contagem de linhas por tabela.
4. Subir a VM na Oracle, instalar Docker e publicar a imagem.
5. Configurar todas as variáveis de ambiente, incluindo `DOCUMENT_HASH_SECRET`, antes do primeiro acesso.
6. Apontar o domínio e configurar HTTPS.
7. Atualizar a URL do webhook na Cakto.
8. Manter o Railway ligado até a nova instalação responder corretamente, e só então desligar.

## Antes de qualquer migração

- `pg_dump` completo guardado fora do Railway e fora da Oracle.
- Backup automático diário configurado no destino.
- Uma restauração de teste, comprovando que o backup funciona.
