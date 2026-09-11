-- O que a Receita disse sobre o fornecedor no dia do cadastro.
--
-- O cadastro sempre consultou a Receita, mas guardava só o ramo de atividade
-- e jogava fora o resto — justamente o que denuncia empresa de fachada:
-- situação, data de abertura, porte, capital. Agora guarda.
--
-- Serve a duas pessoas. A quem revisa a fila do back office, que passa a ver
-- POR QUE a empresa caiu ali, escrito, em vez de ter que consultar o CNPJ na
-- mão uma por uma. E ao comerciante, que vê ao lado do nome do fornecedor
-- "empresa ativa há 5 anos" — algo que ele consegue conferir, e por isso vale
-- mais que qualquer selo que a gente inventasse.
--
-- É fotografia do dia do cadastro, não situação ao vivo. Uma empresa pode ser
-- baixada depois; conferir de novo periodicamente é outro trabalho.

-- Os motivos que mandaram a empresa para a fila, como a tela vai mostrar:
-- [{"peso":"grave"|"atencao","texto":"..."}]. Vazio quando passou direto.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS supplier_motivos jsonb NOT NULL DEFAULT '[]';

ALTER TABLE companies ADD COLUMN IF NOT EXISTS receita_aberta_em date;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS receita_situacao text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS receita_porte text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS receita_capital numeric(14,2);
-- Quando a consulta aconteceu. Sem isto não dá para saber se "ativa" é de
-- ontem ou de dois anos atrás.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS receita_consultada_em timestamptz;
