// Os dois lados da Central. Ambos assinam, fazem o teste de 7 dias e
// respondem à mesma trava de CPF/CNPJ — o tipo define apenas qual painel a
// pessoa usa e o que ela cadastra.
export type AccountType = "comerciante" | "fornecedor";

export const accountTypeLabels: Record<AccountType, string> = {
  comerciante: "Comerciante",
  fornecedor: "Fornecedor",
};

export const accountTypeDescriptions: Record<AccountType, string> = {
  comerciante: "Tenho um comércio e quero comparar preços, margens e fornecedores.",
  fornecedor: "Forneço para o comércio e quero ser encontrado por quem compra.",
};

export const homePathFor = (accountType: AccountType) =>
  accountType === "fornecedor" ? "/fornecedor" : "/dashboard";
