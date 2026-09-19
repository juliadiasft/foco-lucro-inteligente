import { descreverBusca, novosFornecedores, type FiltrosDaBusca } from "../busca-salva";
import { avisarEmpresa } from "./notifications.server";
import { consultarOfertas } from "./busca-fornecedores.server";
import { query } from "./db.server";

type LinhaSalva = {
  id: string;
  company_id: string;
  term: string | null;
  only_my_segments: boolean;
  uf: string | null;
  city: string | null;
  max_delivery_days: number | null;
  category_id: string | null;
  only_available: boolean;
  max_minimum_order: string | null;
  only_known: boolean;
  fornecedores_vistos: string[];
};

export const filtrosDaLinha = (l: LinhaSalva): FiltrosDaBusca => ({
  term: l.term,
  onlyMySegments: l.only_my_segments,
  uf: l.uf,
  city: l.city,
  maxDeliveryDays: l.max_delivery_days,
  categoryId: l.category_id,
  onlyAvailable: l.only_available,
  maxMinimumOrder: l.max_minimum_order === null ? null : Number(l.max_minimum_order),
  onlyKnown: l.only_known,
});

/**
 * Um fornecedor publicou ou mexeu na tabela: alguma busca guardada passou a
 * caber nele? Avisa uma vez por fornecedor e busca. A busca é a mesma da tela
 * (consultarOfertas), restrita a esse fornecedor.
 */
export async function avisarBuscasSalvas(fornecedorId: string) {
  const salvas = await query<LinhaSalva>(
    `SELECT id, company_id, term, only_my_segments, uf, city, max_delivery_days,
            category_id, only_available, max_minimum_order::text, only_known, fornecedores_vistos::text[] AS fornecedores_vistos
       FROM buscas_salvas
      WHERE NOT ($1::uuid = ANY(fornecedores_vistos))
      LIMIT 1000`,
    [fornecedorId],
  );
  for (const salva of salvas.rows) {
    const filtros = filtrosDaLinha(salva);
    const ofertas = await consultarOfertas(salva.company_id, filtros, fornecedorId);
    if (novosFornecedores(salva.fornecedores_vistos, [fornecedorId]).length === 0) continue;
    if (ofertas.length === 0) continue;
    // Marca como visto antes de avisar: se o aviso falhar, melhor perder um
    // do que repetir a cada edição de tabela.
    await query(
      "UPDATE buscas_salvas SET fornecedores_vistos = array_append(fornecedores_vistos, $2::uuid) WHERE id=$1",
      [salva.id, fornecedorId],
    );
    const descricao = descreverBusca(filtros);
    await avisarEmpresa(salva.company_id, {
      tipo: "fornecedor_na_busca",
      title: `${ofertas[0].supplier_name} entrou na sua busca`,
      message: `Apareceu um fornecedor para ${descricao}. Veja os preços.`,
      url: "/comprar",
      chave: `busca-salva:${salva.id}:${fornecedorId}`,
    });
  }
}
