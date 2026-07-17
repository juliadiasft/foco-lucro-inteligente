
-- Função atômica para registrar venda com verificação e baixa de estoque
CREATE OR REPLACE FUNCTION public.registrar_venda(
  p_cliente_nome text,
  p_forma_pagamento forma_pagamento,
  p_desconto numeric,
  p_itens jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_user_id uuid := auth.uid();
  v_venda_id uuid;
  v_item jsonb;
  v_produto public.produtos%ROWTYPE;
  v_qtd numeric;
  v_subtotal numeric := 0;
  v_custo_total numeric := 0;
  v_total numeric;
  v_lucro numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT empresa_id INTO v_empresa_id FROM public.profiles WHERE id = v_user_id;
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada para o usuário';
  END IF;

  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Nenhum item informado';
  END IF;

  -- Trava e valida cada produto (evita corrida em vendas simultâneas)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_qtd := (v_item->>'quantidade')::numeric;
    IF v_qtd IS NULL OR v_qtd <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida';
    END IF;

    SELECT * INTO v_produto
    FROM public.produtos
    WHERE id = (v_item->>'produto_id')::uuid
      AND empresa_id = v_empresa_id
      AND ativo = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado ou inativo';
    END IF;

    IF v_produto.estoque_atual < v_qtd THEN
      RAISE EXCEPTION 'Estoque insuficiente para "%": disponível %, solicitado %',
        v_produto.nome, v_produto.estoque_atual, v_qtd;
    END IF;

    v_subtotal := v_subtotal + (v_produto.preco_venda * v_qtd);
    v_custo_total := v_custo_total + (v_produto.preco_custo * v_qtd);
  END LOOP;

  v_total := GREATEST(0, v_subtotal - COALESCE(p_desconto, 0));
  v_lucro := v_total - v_custo_total;

  INSERT INTO public.vendas (
    empresa_id, created_by, cliente_nome, forma_pagamento,
    subtotal, desconto, total, custo_total, lucro
  ) VALUES (
    v_empresa_id, v_user_id, NULLIF(p_cliente_nome, ''), p_forma_pagamento,
    v_subtotal, COALESCE(p_desconto, 0), v_total, v_custo_total, v_lucro
  ) RETURNING id INTO v_venda_id;

  -- Insere itens e movimentações (trigger baixa estoque)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_qtd := (v_item->>'quantidade')::numeric;

    SELECT * INTO v_produto FROM public.produtos
    WHERE id = (v_item->>'produto_id')::uuid;

    INSERT INTO public.vendas_itens (
      venda_id, produto_id, quantidade, preco_unitario, custo_unitario, subtotal
    ) VALUES (
      v_venda_id, v_produto.id, v_qtd,
      v_produto.preco_venda, v_produto.preco_custo,
      v_produto.preco_venda * v_qtd
    );

    INSERT INTO public.movimentacoes_estoque (
      empresa_id, produto_id, tipo, quantidade, custo_unitario, observacao, created_by
    ) VALUES (
      v_empresa_id, v_produto.id, 'saida', v_qtd, v_produto.preco_custo,
      'Venda #' || substr(v_venda_id::text, 1, 8), v_user_id
    );
  END LOOP;

  RETURN v_venda_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_venda(text, forma_pagamento, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_venda(text, forma_pagamento, numeric, jsonb) TO authenticated;
