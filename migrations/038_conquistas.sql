-- Conquistas da premiação por resultado (etapa 6). Uma linha por empresa e por
-- degrau, gravada uma vez só: o registro é a prova da conquista, então pedido
-- cancelado depois não a tira.
--
-- Os campos de entrega guardam o endereço para onde a Central manda o
-- mascotinho (só o degrau de R$ 10 mil tem prêmio físico). É dado pessoal:
-- aparece só para a própria empresa e para a equipe da Central.
CREATE TABLE IF NOT EXISTS conquistas (
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  degrau integer NOT NULL CHECK (degrau > 0),
  conquistada_em timestamptz NOT NULL DEFAULT now(),
  total_na_data numeric(14,2) NOT NULL DEFAULT 0,
  entrega_status text NOT NULL DEFAULT 'sem_premio'
    CHECK (entrega_status IN ('sem_premio', 'pendente', 'endereco_enviado', 'enviado', 'entregue')),
  destinatario text,
  telefone text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  endereco_enviado_em timestamptz,
  PRIMARY KEY (company_id, degrau)
);
