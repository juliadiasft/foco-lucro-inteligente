
-- Lock down SECURITY DEFINER functions: revoke public/anon access; grant only what's needed.

-- Trigger functions: only invoked by the trigger system; no direct callers.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aplicar_movimentacao_estoque() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Helpers used inside RLS policies / by signed-in users only.
REVOKE ALL ON FUNCTION public.has_role(uuid, uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.current_empresa_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_empresa_id() TO authenticated;

-- RPC called by signed-in users to register a sale.
REVOKE ALL ON FUNCTION public.registrar_venda(text, public.forma_pagamento, numeric, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_venda(text, public.forma_pagamento, numeric, jsonb) TO authenticated;
