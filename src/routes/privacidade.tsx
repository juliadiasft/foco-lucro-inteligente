import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteLayout } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [{ title: "Privacidade — Central do Comerciante" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <SiteLayout>
      <main className="container mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-bold">Política de Privacidade</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Última atualização: 11 de agosto de 2026.
        </p>

        <div className="mt-10 space-y-8 leading-7 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Dados tratados</h2>
            <p className="mt-2">
              Tratamos dados de cadastro, acesso, equipe, produtos, fornecedores, estoque, vendas,
              cotações, configurações e histórico de uso necessários para operar a plataforma. Dados
              de cada empresa ficam vinculados ao seu próprio ambiente autenticado.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">
              2. Uso da inteligência artificial
            </h2>
            <p className="mt-2">
              Quando um usuário envia uma pergunta ao Consultor de Lucro, podemos encaminhar à
              OpenAI a pergunta e o contexto operacional necessário: totais de vendas e lucro, nomes
              e preços de produtos, estoque, metas, fornecedores e cotações. Não incluímos senhas,
              dados de cartão nem dados de outras empresas. As solicitações são enviadas com
              armazenamento de respostas desativado na API, conforme a configuração técnica da
              plataforma.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Prestadores essenciais</h2>
            <p className="mt-2">
              Podemos usar OpenAI para respostas da IA, Cakto para assinatura e pagamento, Resend
              para e-mails transacionais e provedores de hospedagem e banco de dados. Cada prestador
              recebe somente o necessário para executar sua função.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Segurança e acesso</h2>
            <p className="mt-2">
              Senhas são armazenadas de forma derivada, sessões usam cookies protegidos e as
              consultas são limitadas à empresa autenticada. Nenhum sistema é absolutamente
              invulnerável; por isso, também mantemos controles de acesso e recomendamos senhas
              exclusivas.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Direitos e contato</h2>
            <p className="mt-2">
              Você pode solicitar acesso, correção ou exclusão de dados e informações sobre o
              tratamento pelo e-mail contato@centraldocomerciante.com.br. Alguns registros podem ser
              mantidos pelo prazo exigido por lei ou para exercício regular de direitos.
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          Consulte também os{" "}
          <Link to="/termos" className="text-primary underline">
            Termos de Uso
          </Link>
          .
        </p>
      </main>
    </SiteLayout>
  );
}
