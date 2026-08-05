import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteLayout } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/termos")({
  head: () => ({ meta: [{ title: "Termos de Uso — Central do Comerciante" }] }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <SiteLayout>
      <main className="container mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-bold">Termos de Uso</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Última atualização: 4 de agosto de 2026.
        </p>

        <div className="mt-10 space-y-8 leading-7 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Finalidade</h2>
            <p className="mt-2">
              A Central do Comerciante auxilia no controle gerencial de produtos, estoque,
              fornecedores, vendas, lucro, metas e relatórios. Ela não substitui sistema fiscal,
              contabilidade, consultoria jurídica ou decisão profissional do usuário.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Conta e responsabilidades</h2>
            <p className="mt-2">
              O titular deve fornecer informações corretas, manter sua senha protegida, controlar os
              acessos da equipe e revisar dados e recomendações antes de agir. É proibido usar a
              plataforma para fraude, atividade ilegal ou tentativa de acesso a outras contas.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">3. IA e recomendações</h2>
            <p className="mt-2">
              Respostas geradas por IA podem conter imprecisões e servem como apoio gerencial. O
              usuário deve conferir valores e considerar seu contexto antes de alterar preços,
              compras ou outras decisões financeiras.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Teste, planos e cobrança</h2>
            <p className="mt-2">
              Novas contas recebem 7 dias de teste no plano Profissional. Após o teste, o acesso
              exige um plano ativo. Valores, limites e recursos aparecem na página de Planos. A
              assinatura é recorrente e pode ser gerenciada pelo portal de cobrança.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">
              5. Disponibilidade e encerramento
            </h2>
            <p className="mt-2">
              Podemos realizar manutenções, corrigir falhas e suspender uso que viole estes termos.
              O usuário pode cancelar a assinatura; a exclusão definitiva de dados pode ser
              solicitada pelo canal de contato, respeitadas obrigações legais aplicáveis.
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          O tratamento de dados está explicado na{" "}
          <Link to="/privacidade" className="text-primary underline">
            Política de Privacidade
          </Link>
          .
        </p>
      </main>
    </SiteLayout>
  );
}

