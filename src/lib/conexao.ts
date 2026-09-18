// Sem internet (X06): dizer o que a pessoa está vendo, e não fingir que é vivo.
//
// O app não guarda dados no aparelho: sem conexão, as telas já abertas seguem
// mostrando o que foi carregado, e o que ainda não foi carregado não abre. A
// faixa diz isso com a hora do último dado — sem prometer o que não existe
// (cadastrar produto offline, sincronizar depois).

/** A hora do dado mais recente entre as consultas em cache, ou nulo. */
export function ultimoCarregamento(consultas: { dataUpdatedAt: number }[]): number | null {
  const tempos = consultas.map((c) => c.dataUpdatedAt).filter((t) => t > 0);
  return tempos.length ? Math.max(...tempos) : null;
}

export function mensagemSemInternet(hora: string | null): string {
  return hora
    ? `Mostrando o que foi carregado às ${hora}. O que precisa de conexão volta quando ela voltar.`
    : "O que precisa de conexão volta quando ela voltar.";
}
