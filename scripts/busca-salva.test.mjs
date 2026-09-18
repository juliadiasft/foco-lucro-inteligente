// Testa a busca guardada (o "avisar" do X04).
//
//   node scripts/busca-salva.test.mjs
import process from "node:process";

const falhas = [];
const ok = (c, m) => {
  console.log(`${c ? "  ok  " : " FALHA"}  ${m}`);
  if (!c) falhas.push(m);
};

const { chaveDaBusca, descreverBusca, novosFornecedores } =
  await import("../src/lib/busca-salva.ts");
const base = {
  term: "Ração Golden",
  onlyMySegments: true,
  uf: "sp",
  city: null,
  maxDeliveryDays: 1,
  categoryId: null,
  onlyAvailable: false,
};

ok(
  chaveDaBusca(base) === chaveDaBusca({ ...base, term: "  ração golden ", uf: "SP" }),
  "caixa e espaço não criam busca nova",
);
ok(
  chaveDaBusca(base) !== chaveDaBusca({ ...base, maxDeliveryDays: 2 }),
  "filtro diferente = busca diferente",
);
ok(
  chaveDaBusca(base) !== chaveDaBusca({ ...base, onlyMySegments: false }),
  "nicho ligado/desligado = busca diferente",
);
ok(
  chaveDaBusca({ ...base, city: null }) === chaveDaBusca({ ...base, city: "" }),
  "cidade vazia = sem cidade",
);

ok(
  descreverBusca(base) === "Ração Golden · sp · até 1 dia(s)",
  `descrição (${descreverBusca(base)})`,
);
ok(
  descreverBusca({ ...base, term: null, uf: null, maxDeliveryDays: null }) === "sua busca",
  "sem nada a dizer, 'sua busca'",
);

ok(
  novosFornecedores(["a"], ["a", "b", "b"]).join() === "b",
  "só o que não tinha sido visto, sem repetir",
);
ok(novosFornecedores(["a", "b"], ["a"]).length === 0, "nada novo = nenhum aviso");
ok(novosFornecedores([], ["a"]).join() === "a", "primeira vez, avisa");

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s)`);
  process.exit(1);
}
console.log("\ntudo certo");
