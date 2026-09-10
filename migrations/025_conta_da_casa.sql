-- Contas da casa: nunca vencem.
--
-- A conta da Julia, dona da Central, estava sujeita ao mesmo relógio de sete
-- dias dos clientes. O teste venceu em 11/08/2026 e no dia 09/09 ela não
-- conseguia abrir nenhuma tela do próprio sistema — o guarda de acesso fazia
-- exatamente o que devia, e travava a dona do negócio.
--
-- Estender o teste pelo back office resolvia por trinta dias e voltava a
-- travar, provavelmente no meio de uma demonstração para um cliente.
--
-- Esta marca é o que separa "cliente em teste" de "conta que existe para o
-- negócio funcionar": a da dona e a de demonstração. Elas não pagam porque não
-- há para quem pagar, e não vencem porque não há renovação a cobrar.
--
-- Não é um plano nem um privilégio de assinatura: é o reconhecimento de que
-- essas contas não são clientes. Os limites de plano continuam valendo
-- normalmente sobre elas.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS conta_da_casa boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN companies.conta_da_casa IS
  'Conta da própria Central (dona, demonstração). Tem acesso permanente: não depende de teste nem de assinatura.';

-- A conta da dona, pelo e-mail do usuário owner.
--
-- Marcada por e-mail e não por id fixo porque o id muda entre o banco de
-- produção, o local e qualquer restauração de backup — e uma migração que só
-- funciona num deles é uma migração quebrada nos outros.
UPDATE companies c
   SET conta_da_casa = true
 WHERE EXISTS (
   SELECT 1 FROM users u
    WHERE u.company_id = c.id
      AND u.role = 'owner'
      AND lower(u.email) = 'juliadiasfr@gmail.com'
 );

-- A conta de demonstração, usada para mostrar o sistema funcionando.
-- Travar no meio de uma apresentação é o pior momento possível.
UPDATE companies
   SET conta_da_casa = true
 WHERE lower(name) LIKE '%demonstra%';
