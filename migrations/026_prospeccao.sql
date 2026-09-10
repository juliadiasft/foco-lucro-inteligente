-- A lista de prospecção, dentro do sistema.
--
-- Até aqui ela vivia em dois CSV no Desktop da Julia e dois HTML gerados por
-- script. Funciona para uma pessoa numa máquina; não funciona no dia em que
-- entrar o primeiro vendedor, porque a lista passaria a circular por WhatsApp
-- e cada um teria a sua versão do que já foi contatado.
--
-- São 148.655 empresas: 117.371 pet shops (quem compra) e 31.284 fornecedores
-- (quem abastece), tiradas dos Dados Abertos do CNPJ da Receita Federal.
--
-- POR QUE `nicho` E `lado` DESDE AGORA, com um nicho só existindo: acrescentar
-- coluna numa tabela de 148 mil linhas depois é migração pesada, e a Julia já
-- declarou que vem outro nicho. Uma coluna com valor único hoje custa quase
-- nada; a mesma coluna adicionada com a tabela cheia custa uma janela de
-- manutenção.
CREATE TABLE IF NOT EXISTS prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação. O CNPJ é a chave de verdade: é por ele que a reimportação
  -- reconhece quem já está aqui e não duplica.
  cnpj text NOT NULL UNIQUE,
  razao_social text NOT NULL DEFAULT '',
  nome_fantasia text NOT NULL DEFAULT '',

  -- De que lado do balcão está, e de que nicho.
  lado text NOT NULL CHECK (lado IN ('comerciante', 'fornecedor')),
  nicho text NOT NULL DEFAULT 'pet',

  -- Onde fica e como falar.
  cidade text NOT NULL DEFAULT '',
  uf text NOT NULL DEFAULT '',
  telefone text NOT NULL DEFAULT '',
  telefone2 text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  -- Só celular, com o nono dígito, pronto para o link do WhatsApp. Guardado
  -- em vez de calculado na hora porque a lista é filtrada por ele.
  whatsapp text NOT NULL DEFAULT '',

  -- O que a Receita diz.
  situacao text NOT NULL DEFAULT '',
  ramo_principal text NOT NULL DEFAULT '',
  fornece text NOT NULL DEFAULT '',
  -- 'principal' ou 'secundario': se abastecer pet shop é a atividade principal
  -- da empresa ou só um código pendurado no cadastro.
  confere text NOT NULL DEFAULT '',
  -- 'unica', 'matriz' ou 'filial'. Ligar para filial é ligar de novo para a
  -- mesma empresa.
  matriz_ou_filial text NOT NULL DEFAULT 'unica',
  enderecos_da_empresa integer NOT NULL DEFAULT 1,
  -- Quantas empresas atendem neste mesmo telefone. A Petz tem 365 unidades no
  -- mesmo número: é call center, e ligar 365 vezes é ligar uma vez.
  contatos_iguais integer NOT NULL DEFAULT 1,
  -- O único sinal que sai de graça: o nome sugere pet?
  nome_sugere_pet boolean NOT NULL DEFAULT false,

  -- O trabalho de prospecção. É o que a Julia (e o time) preenche.
  status text NOT NULL DEFAULT 'a contatar'
    CHECK (status IN ('a contatar', 'contatado', 'respondeu', 'cadastrou', 'vitrine no ar', 'sem interesse')),
  responsavel_id uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  contatado_em timestamptz,
  quem_falou text NOT NULL DEFAULT '',
  compra_de_quem text NOT NULL DEFAULT '',
  resposta text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',

  -- Virou cliente? Preenchido quando o CNPJ aparece em companies.
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,

  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Os índices seguem exatamente os filtros da tela. Sem eles, cada filtro
-- varre 148 mil linhas — e o banco está em outro continente, onde cada
-- consulta já custa 115ms antes de executar qualquer coisa.
CREATE INDEX IF NOT EXISTS prospects_lado_nicho_idx ON prospects(lado, nicho);
CREATE INDEX IF NOT EXISTS prospects_uf_cidade_idx ON prospects(uf, cidade);
CREATE INDEX IF NOT EXISTS prospects_status_idx ON prospects(status);
CREATE INDEX IF NOT EXISTS prospects_responsavel_idx ON prospects(responsavel_id)
  WHERE responsavel_id IS NOT NULL;
-- A fila do dia: quem dá para contatar agora, do lado e nicho certos.
CREATE INDEX IF NOT EXISTS prospects_fila_idx ON prospects(lado, nicho, status)
  WHERE telefone <> '' AND situacao = 'Ativa';

-- Busca por nome sem depender de acento nem de maiúscula.
CREATE INDEX IF NOT EXISTS prospects_razao_busca_idx ON prospects(lower(razao_social));

COMMENT ON TABLE prospects IS
  'Lista de prospecção vinda dos Dados Abertos do CNPJ. Uso interno do back office — não é dado de cliente da plataforma.';
