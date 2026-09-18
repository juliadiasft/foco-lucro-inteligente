// Testa o idioma do app (português, inglês, espanhol) e as abas do fornecedor.
//
//   node scripts/idioma.test.mjs
//
// O erro fácil é uma tradução ficar pela metade: chave sem texto num idioma,
// ou texto igual ao português por esquecimento — a pessoa vê o app em espanhol
// com um botão em português e acha que é defeito. O tipo já barra chave
// faltando ao compilar; aqui conferimos também vazio e texto copiado.
import process from "node:process";

const falhas = [];
const ok = (condicao, mensagem) => {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${mensagem}`);
  if (!condicao) falhas.push(mensagem);
};

const { IDIOMAS, IDIOMA_PADRAO, ehIdioma, traduzir, DICIONARIOS, LANG_HTML, SCRIPT_DO_IDIOMA } =
  await import("../src/lib/idioma.ts");
const { abaDoFornecedor, ITENS_DE_MAIS_FORNECEDOR } = await import("../src/lib/navegacao.ts");

console.log("--- o padrão e o que vem guardado ---");
ok(IDIOMA_PADRAO === "pt", "o padrão é português, e não o idioma do navegador");
ok(!ehIdioma("pt-BR"), "'pt-BR' não é uma escolha guardada válida");
ok(!ehIdioma(null) && !ehIdioma("") && !ehIdioma("fr"), "nada, vazio e francês são ignorados");
ok(IDIOMAS.every(ehIdioma), "os três idiomas são reconhecidos");
ok(traduzir("xx", "nav.painel") === "Painel", "idioma desconhecido cai no português");

console.log("\n--- nenhuma tradução pela metade ---");
const chaves = Object.keys(DICIONARIOS.pt);
for (const idioma of IDIOMAS) {
  const d = DICIONARIOS[idioma];
  ok(
    chaves.every((c) => typeof d[c] === "string" && d[c].trim() !== ""),
    `${idioma}: as ${chaves.length} chaves têm texto`,
  );
  ok(Object.keys(d).length === chaves.length, `${idioma}: nenhuma chave sobrando`);
}
// Nomes próprios e siglas iguais nos três idiomas são legítimos.
const IGUAIS_DE_PROPOSITO = new Set([
  "nav.marca",
  "nav.equipe",
  "cfg.temaClaro",
  // Iguais em espanhol de verdade, não esquecimento.
  "nav.comprar",
  "nav.pedidos",
  "forn.catalogoCurto",
  "cfg.idiomaTitulo",
  "cfg.avisoFiscalTitulo",
]);
for (const idioma of ["en", "es"]) {
  const copiadas = chaves.filter(
    (c) => DICIONARIOS[idioma][c] === DICIONARIOS.pt[c] && !IGUAIS_DE_PROPOSITO.has(c),
  );
  ok(copiadas.length === 0, `${idioma}: nada esquecido em português (${copiadas.join(", ")})`);
}

console.log("\n--- o <html lang> ---");
ok(LANG_HTML.pt === "pt-BR" && LANG_HTML.en === "en" && LANG_HTML.es === "es", "lang certo");
ok(SCRIPT_DO_IDIOMA.includes("central-idioma"), "o script do <head> lê a mesma chave");

console.log("\n--- as cinco abas do fornecedor ---");
ok(abaDoFornecedor("/fornecedor") === "painel", "/fornecedor é o Painel");
ok(abaDoFornecedor("/fornecedor/orcamentos") === "orcamentos", "Orçamentos");
ok(abaDoFornecedor("/fornecedor/orcamentos/7") === "orcamentos", "um orçamento aberto");
ok(abaDoFornecedor("/fornecedor/catalogo") === "catalogo", "Catálogo");
ok(abaDoFornecedor("/fornecedor/conversas") === "conversas", "Conversas");
ok(abaDoFornecedor("/fornecedor/mais") === "mais", "Mais");
for (const item of ITENS_DE_MAIS_FORNECEDOR)
  ok(abaDoFornecedor(item.to) === "mais", `${item.to} fica em Mais`);
ok(abaDoFornecedor("/fornecedor/catalogox") === "painel", "prefixo não pega vizinho");

if (falhas.length) {
  console.log(`\n${falhas.length} falha(s).`);
  process.exit(1);
}
console.log("\nTudo certo.");
