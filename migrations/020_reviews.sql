-- Avaliacao amarrada a pedido concluido.
--
-- Sem essa amarracao viraria mural de recado e perderia o valor: o
-- comerciante confia na nota justamente porque quem deu a nota comprou de
-- verdade. Os dois lados podem avaliar, cada um uma vez por pedido.
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  author_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subject_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rating integer NOT NULL,
  comment text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, author_company_id)
);

ALTER TABLE reviews
  ADD CONSTRAINT reviews_rating_check CHECK (rating BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS reviews_subject_idx
  ON reviews(subject_company_id, created_at DESC);
