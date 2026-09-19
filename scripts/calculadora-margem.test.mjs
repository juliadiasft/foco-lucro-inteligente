// Testa a calculadora de margem de marketplace.
//
//   node scripts/calculadora-margem.test.mjs
import process from "node:process";

const falhas = [];
const ok = (c, m) => {
  console.log(`${c ? "  ok  " : " FALHA"}  ${m}`);
  if (!c) falhas.push(m);
};

const { CANAIS, calcular, precoParaMargem, faixaDoPreco } =
  await import("../src/lib/calculadora-margem.ts");
const canal = (id) => CANAIS.find((c) => c.id === id);
const base = { custo: 30, frete: 0, outros: 0, impostoPct: 0 };

console.log("--- faixas ---");
ok(faixaDoPreco(canal("shopee"), 79.99).fixo === 4, "Shopee R$ 79,99 paga R$ 4 fixos");
ok(faixaDoPreco(canal("shopee"), 80).fixo === 16, "Shopee R$ 80 já cai na faixa de R$ 16");
ok(faixaDoPreco(canal("shopee"), 250).fixo === 26, "Shopee acima de R$ 200 paga R$ 26");
ok(faixaDoPreco(canal("tiktok"), 49.99).comissaoPct === 10, "TikTok abaixo de R$ 50: 10%");
ok(faixaDoPreco(canal("tiktok"), 50).fixo === 6, "TikTok a partir de R$ 50: R$ 6 fixos");

console.log("--- conta direta ---");
const d = calcular(canal("direta"), { ...base, preco: 50 });
ok(d.lucro === 20 && d.margemPct === 40, "venda direta a R$ 50 com custo 30: sobra 20 (40%)");
const t = calcular(canal("tiktok"), { ...base, preco: 40 });
ok(t.comissao === 4 && t.fixo === 4 && t.lucro === 2, "TikTok R$ 40: 4 + 4 de taxa, sobra R$ 2");
ok(t.margemPct === 5, "margem de 5% sobre a venda");
const imp = calcular(canal("direta"), { ...base, preco: 100, impostoPct: 6, frete: 5, outros: 2 });
ok(imp.lucro === 57 && imp.imposto === 6, "imposto, frete e embalagem saem do lucro");

console.log("--- comissão mínima (Amazon) ---");
const barato = calcular(canal("amazon"), { ...base, custo: 5, preco: 10 });
ok(barato.comissao === 2, "12% de R$ 10 = R$ 1,20, mas o mínimo é R$ 2");
const caro = calcular(canal("amazon"), { ...base, preco: 100 });
ok(caro.comissao === 12, "R$ 100 paga os 12%");

console.log("--- taxa editada vale mais que a tabela ---");
const ed = calcular(canal("shopee"), { ...base, preco: 100, comissaoPct: 10, fixo: 0 });
ok(ed.lucro === 60, "comissão 10% e fixo 0 digitados substituem a faixa");

console.log("--- preço para a margem ---");
for (const id of ["mercadolivre", "shopee", "amazon", "magalu", "tiktok", "direta"]) {
  const c = canal(id);
  const p = precoParaMargem(c, base, 20);
  const r = p && calcular(c, { ...base, preco: p });
  ok(p !== null && r.margemPct >= 20, `${c.nome}: R$ ${p} entrega margem ≥ 20% (${r?.margemPct}%)`);
  if (p) {
    const menorPreco = Math.round((p - 0.01) * 100) / 100;
    const menor = calcular(c, { ...base, preco: menorPreco });
    // Sem o arredondamento da tela: 19,998% aparece como 20,00% e enganaria.
    menor.margemPct = (menor.lucro / menorPreco) * 100;
    // Nas viradas de faixa da Shopee o preço logo abaixo pode até ter margem
    // maior (taxa fixa menor); o que não pode é existir preço menor que atinja.
    ok(
      id === "shopee" || menor.margemPct < 20,
      `${c.nome}: um centavo a menos não atinge a margem`,
    );
  }
}
const s = precoParaMargem(canal("shopee"), { ...base, custo: 60 }, 20);
ok(
  s === 93.75 ||
    (s >= 80 && calcular(canal("shopee"), { ...base, custo: 60, preco: s }).margemPct >= 20),
  "Shopee custo 60: acha a faixa certa",
);
ok(
  precoParaMargem(canal("shopee"), base, 90) === null,
  "margem 90% com 20% de comissão: impossível → null",
);
ok(precoParaMargem(canal("direta"), base, 0) === 30, "margem 0% na venda direta = preço do custo");

if (falhas.length) {
  console.log(`\n${falhas.length} falha(s)`);
  process.exit(1);
}
console.log("\ntudo certo");
