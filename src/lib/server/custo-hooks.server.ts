// O custo automático nunca pode derrubar a operação que o disparou: pedido
// concluído, planilha importada e tabela salva valem mais que a estimativa.
// Por isso cada gancho abre a própria transação e engole o erro (registrando).
import {
  registrarCustoDaCompra,
  sincronizarCustoDoFornecedor,
  sincronizarCustoEstimado,
} from "./custo-automatico.server";
import { transaction } from "./db.server";

async function seguro(descricao: string, trabalho: Parameters<typeof transaction>[0]) {
  try {
    await transaction(trabalho);
  } catch (error) {
    console.error(`Custo automático falhou (${descricao})`, error);
  }
}

export const custoAposMexerNosProdutos = (empresa: string) =>
  seguro("produtos", (client) => sincronizarCustoEstimado(client, { empresa }));

export const custoAposMexerNaTabela = (fornecedor: string) =>
  seguro("tabela", (client) => sincronizarCustoDoFornecedor(client, fornecedor));

export const custoAposCompra = (pedido: string) =>
  seguro("compra", (client) => registrarCustoDaCompra(client, pedido));
