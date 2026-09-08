import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { query } from "../server/db.server";

// Vitrine pública do fornecedor: a única parte da plataforma que responde sem
// login. Existe por dois motivos que se reforçam — o Google só indexa o que
// consegue abrir sem senha, e o fornecedor só tem um link para divulgar se
// esse link funcionar para quem ainda não é cliente.
//
// O que NÃO sai daqui, e o porquê de cada um:
//
//   telefone e e-mail — publicados numa página que o Google lê viram alvo de
//   robô de spam em semanas. Quem se prejudica é o fornecedor, justamente
//   quem a página deveria ajudar. O contato fica atrás do cadastro.
//
//   preços — o concorrente do fornecedor também usa o Google. Expor a tabela
//   dele publicamente seria entregar a arma para o outro lado, e nenhum
//   distribuidor publicaria a vitrine sabendo disso. Além do mais, comparar
//   preço é exatamente o que o comerciante assina para fazer.
//
// O que sai: quem é, onde fica, o que carrega, prazo, pedido mínimo e os
// sinais de confiança que já existem. Valor suficiente para a página valer a
// visita, sem entregar o que sustenta a assinatura.

export type VitrinePublicaItem = {
  nome: string;
  marca: string | null;
  categoria: string | null;
};

const slugSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    // Só o que o próprio gerador de slug produz. Fecha a porta para qualquer
    // coisa criativa vinda da URL antes de chegar ao banco.
    .regex(/^[a-z0-9-]+$/),
});

export const getPublicSupplier = createServerFn({ method: "GET" })
  .validator(slugSchema)
  .handler(async ({ data }) => {
    const perfil = await query<{
      company_id: string;
      nome: string;
      descricao: string | null;
      cidade: string | null;
      uf: string | null;
      prazo: number | null;
      pedido_minimo: string | null;
      condicoes_pagamento: string | null;
      nichos: string | null;
      itens: string;
      concluidos: string;
      respondidos: string;
      recebidos: string;
      nota: string | null;
      avaliacoes: string;
    }>(
      `SELECT c.id company_id,
              coalesce(sp.display_name, c.name) nome,
              sp.description descricao,
              c.city cidade, c.uf,
              sp.delivery_days prazo,
              sp.minimum_order pedido_minimo,
              sp.payment_terms condicoes_pagamento,
              (SELECT string_agg(sg.name, ', ' ORDER BY sg.sort_order)
                 FROM company_segments cs JOIN segments sg ON sg.id=cs.segment_id
                WHERE cs.company_id=c.id) nichos,
              (SELECT count(*) FROM supplier_offerings o
                WHERE o.company_id=c.id AND o.active=true)::text itens,
              (SELECT count(*) FROM purchase_orders po
                WHERE po.supplier_company_id=c.id AND po.status='concluido')::text concluidos,
              (SELECT count(*) FROM quote_requests q
                WHERE q.supplier_company_id=c.id AND q.status <> 'aberto')::text respondidos,
              (SELECT count(*) FROM quote_requests q
                WHERE q.supplier_company_id=c.id)::text recebidos,
              (SELECT avg(rating)::text FROM reviews r WHERE r.subject_company_id=c.id) nota,
              (SELECT count(*) FROM reviews r WHERE r.subject_company_id=c.id)::text avaliacoes
         FROM supplier_profiles sp
         JOIN companies c ON c.id=sp.company_id
        WHERE sp.slug=$1
          AND sp.published=true
          AND c.account_type='fornecedor'`,
      [data.slug],
    );

    // Vitrine despublicada devolve o mesmo nada que uma que nunca existiu: o
    // fornecedor que desligou a chave não quer explicar a ninguém que já
    // esteve ali.
    if (!perfil.rows.length) return null;
    const p = perfil.rows[0];

    const itens = await query<{ nome: string; marca: string | null; categoria: string | null }>(
      `SELECT ci.name nome, ci.brand marca, pc.name categoria
         FROM supplier_offerings o
         JOIN catalog_items ci ON ci.id=o.catalog_item_id
         LEFT JOIN product_categories pc ON pc.id=ci.category_id
        WHERE o.company_id=$1 AND o.active=true
        ORDER BY pc.sort_order NULLS LAST, ci.name
        LIMIT 60`,
      [p.company_id],
    );

    const recebidos = Number(p.recebidos);
    return {
      nome: p.nome,
      descricao: p.descricao,
      cidade: p.cidade,
      uf: p.uf,
      prazoEntrega: p.prazo,
      pedidoMinimo: p.pedido_minimo === null ? null : Number(p.pedido_minimo),
      condicoesPagamento: p.condicoes_pagamento,
      nichos: p.nichos,
      totalItens: Number(p.itens),
      pedidosConcluidos: Number(p.concluidos),
      taxaResposta: recebidos > 0 ? (Number(p.respondidos) / recebidos) * 100 : null,
      nota: p.nota === null ? null : Number(p.nota),
      avaliacoes: Number(p.avaliacoes),
      itens: itens.rows as VitrinePublicaItem[],
    };
  });

// Alimenta o sitemap. Sem ele o Google depende de alguém linkar cada vitrine
// para descobrir que ela existe, e uma vitrine nova pode passar meses invisível.
export const listPublicSuppliers = createServerFn({ method: "GET" }).handler(async () => {
  const result = await query<{ slug: string; atualizado: string }>(
    `SELECT sp.slug, sp.updated_at::text atualizado
       FROM supplier_profiles sp
       JOIN companies c ON c.id=sp.company_id
      WHERE sp.published=true
        AND sp.slug IS NOT NULL
        AND c.account_type='fornecedor'
      ORDER BY sp.updated_at DESC
      LIMIT 5000`,
  );
  return result.rows.map((row) => ({ slug: row.slug, atualizado: row.atualizado }));
});
