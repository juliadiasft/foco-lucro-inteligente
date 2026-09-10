-- Verificação do fornecedor.
--
-- Desde 09/09/2026 o fornecedor entra de graça. O que era barreira de preço
-- some, e some junto o filtro natural que ela fazia: quem paga R$ 79,90 por
-- mês raramente é fornecedor de mentira.
--
-- O risco que sobra não é de receita, é de qualidade. Vitrine falsa com preço
-- inventado não custa assinatura nenhuma — envenena a comparação, que é o
-- produto inteiro. Um comerciante que confere um preço aqui, vai ao
-- fornecedor e descobre que era mentira, não volta.
--
-- Estado nasce em 'em_analise' e só a verificação move para 'aprovado'. O
-- padrão errado aqui seria 'aprovado': qualquer caminho novo que esqueça de
-- marcar passaria a publicar sem conferência.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS supplier_verification text NOT NULL DEFAULT 'em_analise';

-- Apaga antes de criar porque o Postgres não tem "ADD CONSTRAINT IF NOT
-- EXISTS". Sem isto, rodar as migrações duas vezes sobre o mesmo banco morre
-- com 'constraint "companies_supplier_verification_check" already exists' — e
-- aí não é só a 024 que falha: a migração para de rodar ali, e as seguintes
-- nunca chegam a ser aplicadas.
--
-- Acontece de verdade ao restaurar um backup por cima de um banco que já tem
-- estrutura, e ao subir o banco local depois de rodar o migrate à mão.
ALTER TABLE companies
  DROP CONSTRAINT IF EXISTS companies_supplier_verification_check;
ALTER TABLE companies
  ADD CONSTRAINT companies_supplier_verification_check
  CHECK (supplier_verification IN ('em_analise', 'aprovado', 'recusado'));

-- Guarda o que a Receita respondeu no momento do cadastro. Sem isto, quem
-- revisa a fila no back office não tem como saber por que a empresa caiu ali —
-- e teria que consultar o CNPJ de novo, na mão, uma por uma.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS supplier_cnae text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS supplier_cnae_descricao text;

-- Quem já estava dentro antes desta regra continua aprovado: a trava é para
-- cadastro novo, e não para punir quem entrou quando a porta era outra.
UPDATE companies SET supplier_verification = 'aprovado'
 WHERE account_type = 'fornecedor';

-- Comerciante não é fornecedor e nunca passa por esta fila. Deixar 'aprovado'
-- evita que uma consulta distraída conte mercadinho como pendência.
UPDATE companies SET supplier_verification = 'aprovado'
 WHERE account_type = 'comerciante';

-- A fila da revisão é lida por status; sem índice ela varre a tabela inteira.
CREATE INDEX IF NOT EXISTS companies_supplier_verification_idx
  ON companies(supplier_verification)
  WHERE account_type = 'fornecedor';
