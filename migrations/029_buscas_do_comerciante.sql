-- O que os comerciantes procuram — inclusive quando não acham nada.
--
-- Existe por um motivo comercial, não técnico. O fornecedor que acaba de se
-- cadastrar abre o painel e vê "nenhum cliente esperando agora": três vazios
-- em sequência para quem chegou há um minuto. Não há como ele saber se vale a
-- pena montar o catálogo, porque nada na tela diz que existe demanda.
--
-- O gancho que resolve isso é: "14 buscas de mercearia num raio de 40 km esta
-- semana — você não apareceu em nenhuma". Isso é verdadeiro, é específico, e
-- transforma o catálogo de tarefa chata em dinheiro deixado na mesa.
--
-- Mas esse número só existe se alguém tiver gravado as buscas. Por isso a
-- tabela entra agora, antes da tela: cada dia sem gravar é um dia de dado que
-- não volta. Custa uma linha por busca.
--
-- A busca que NÃO achou nada é a mais valiosa das duas: é ela que diz qual
-- item falta na praça.
CREATE TABLE IF NOT EXISTS buscas_do_comerciante (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Quem procurou. Serve para não contar a mesma loja dez vezes como dez
  -- comerciantes interessados.
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- O texto digitado, normalizado como o sistema normaliza (sem acento, minúsculo).
  -- Vazio quando a pessoa só filtrou por categoria em vez de digitar.
  termo text NOT NULL DEFAULT '',
  categoria_id text,
  -- Onde o comerciante está. É o que permite dizer "na sua região" para o
  -- fornecedor, em vez de um número nacional que não significa nada.
  cidade text,
  uf text,
  -- Quantas ofertas a busca devolveu. Zero é o sinal mais forte do sistema:
  -- alguém queria comprar e a Central não tinha o que mostrar.
  resultados integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- O painel do fornecedor pergunta "buscas dos últimos 7 dias na minha região".
CREATE INDEX IF NOT EXISTS buscas_do_comerciante_periodo
  ON buscas_do_comerciante (criado_em DESC);

CREATE INDEX IF NOT EXISTS buscas_do_comerciante_regiao
  ON buscas_do_comerciante (uf, cidade, criado_em DESC);
