-- Vitrine pública do fornecedor.
--
-- Até aqui o fornecedor pagava para publicar uma vitrine que ninguém de fora
-- conseguia ver: todo o /fornecedor exige login e assinatura ativa. A promessa
-- vendida a ele — "aqui você é encontrado pelo comércio" — não se cumpria,
-- porque só era encontrado por quem já estava dentro pagando.
--
-- O endereço precisa ser legível e estável. Um uuid na URL não é indexável de
-- forma útil nem se manda em grupo de WhatsApp, e mudar o endereço depois
-- quebraria todo link já compartilhado. Por isso o slug vira coluna: nasce do
-- nome, e a partir daí não muda mesmo que o fornecedor renomeie a vitrine.
ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS slug text;

-- Backfill dos perfis que já existem. Sem depender da extensão unaccent, que
-- nem todo servidor tem instalada: translate() resolve os acentos do português
-- e é determinístico em qualquer Postgres.
WITH base AS (
  SELECT company_id,
         nullif(
           trim(both '-' from regexp_replace(
             lower(translate(
               coalesce(display_name, ''),
               'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
               'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'
             )),
             '[^a-z0-9]+', '-', 'g'
           )),
           ''
         ) AS raw
    FROM supplier_profiles
   WHERE slug IS NULL
),
-- Dois fornecedores podem se chamar igual. O primeiro fica com o nome limpo,
-- os seguintes ganham um número — determinado pelo company_id, para que rodar
-- a migração duas vezes não troque os endereços de lugar.
numerado AS (
  SELECT company_id,
         coalesce(raw, 'fornecedor') AS raw,
         row_number() OVER (
           PARTITION BY coalesce(raw, 'fornecedor') ORDER BY company_id
         ) AS n
    FROM base
)
UPDATE supplier_profiles sp
   SET slug = CASE WHEN numerado.n = 1 THEN numerado.raw
                   ELSE numerado.raw || '-' || numerado.n END
  FROM numerado
 WHERE sp.company_id = numerado.company_id;

-- Duas vitrines no mesmo endereço serviriam a página errada para alguém.
CREATE UNIQUE INDEX IF NOT EXISTS supplier_profiles_slug_idx
  ON supplier_profiles(slug);
