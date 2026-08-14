-- Conversa entre comerciante e fornecedor dentro da própria Central, para
-- ninguém precisar sair para o WhatsApp no meio da comparação.
--
-- Uma conversa por par de empresas: o comerciante encontra sempre o mesmo fio,
-- como em qualquer aplicativo de mensagem, em vez de abrir uma conversa nova a
-- cada produto.
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES catalog_items(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_company_id, supplier_company_id)
);

CREATE INDEX IF NOT EXISTS conversations_merchant_idx
  ON conversations(merchant_company_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS conversations_supplier_idx
  ON conversations(supplier_company_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx
  ON messages(conversation_id, created_at);

-- Marca de leitura por pessoa, não por empresa: numa equipe de três, cada um
-- tem o próprio contador de não lidas.
CREATE TABLE IF NOT EXISTS conversation_reads (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
