// O custo automático nunca pode derrubar a operação que o disparou: pedido
// concluído, planilha importada e tabela salva valem mais que a estimativa.
// Por isso cada gancho abre a própria transação e engole o erro (registrando).
import {
  registrarCustoDaCompra,
  sincronizarCustoDoFornecedor,
  sincronizarCustoEstimado,
} from "./custo-automatico.server";
import { transaction } from "./db.server";
import { gerarSinaisDeEconomia, gerarSinaisParaFornecedor } from "./signals.server";

async function seguro(descricao: string, trabalho: Parameters<typeof transaction>[0]) {
  try {
    await transaction(trabalho);
  } catch (error) {
    console.error(`Custo automático falhou (${descricao})`, error);
  }
}

// O aviso de economia vem depois do custo, e solto: quem salvou o produto ou a
// tabela não espera a varredura, e um erro nela não desfaz o que foi salvo.
function avisar(descricao: string, trabalho: () => Promise<unknown>) {
  void trabalho().catch((error) => console.error(`Aviso de economia falhou (${descricao})`, error));
}

export const custoAposMexerNosProdutos = async (empresa: string) => {
  await seguro("produtos", (client) => sincronizarCustoEstimado(client, { empresa }));
  avisar("produtos", () => gerarSinaisDeEconomia(empresa));
};

export const custoAposMexerNaTabela = async (fornecedor: string) => {
  await seguro("tabela", (client) => sincronizarCustoDoFornecedor(client, fornecedor));
  avisar("tabela", () => gerarSinaisParaFornecedor(fornecedor));
};

export const custoAposCompra = (pedido: string) =>
  seguro("compra", (client) => registrarCustoDaCompra(client, pedido));
