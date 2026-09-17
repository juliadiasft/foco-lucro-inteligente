-- Quando foi a Central que subiu a tabela de preços do fornecedor.
--
-- Existe por causa do cadastro assistido: na ligação, o fornecedor diz sim e
-- manda a planilha por WhatsApp. Se a resposta for "entra lá e sobe você", o
-- sim vira tarefa, e tarefa de fornecedor ocupado não acontece. Então a equipe
-- sobe por ele — e isso precisa ficar escrito.
--
-- Precisa ficar escrito por dois motivos, e o segundo é o que importa:
--
-- 1. Ele tem que saber de onde veio aquilo. Se um item veio errado da
--    planilha, ele sabe onde reclamar em vez de achar que o sistema inventou.
--
-- 2. Preço importado envelhece. Se ninguém assume a atualização, a comparação
--    passa a mostrar preço velho — que é pior do que não mostrar nada, porque
--    o comerciante decide compra em cima. A data aqui é o que permite cobrar
--    isso dele, na tela dele, com o dia escrito.
--
-- Uma marca por empresa, e não por item: o que interessa é "esta tabela não
-- foi você quem subiu", e isso vale para a tabela inteira.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS catalogo_importado_em timestamptz;

-- O e-mail de quem da equipe subiu. Fica junto porque a auditoria guarda o
-- registro completo, mas quem olha a conta do fornecedor não abre auditoria.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS catalogo_importado_por text;
