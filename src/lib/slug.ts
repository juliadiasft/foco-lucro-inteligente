// Endereço legível a partir de um nome. Usado na vitrine pública do
// fornecedor, que precisa de uma URL que caiba num grupo de WhatsApp e que o
// Google consiga ler.
//
// A mesma normalização existe em SQL na migração 023, para o backfill dos
// perfis antigos. Se uma mudar, a outra precisa mudar junto.
export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

// Um slug vazio serviria uma URL quebrada; um nome só de emoji ou de
// pontuação chega aqui vazio depois da limpeza.
export function slugOrFallback(value: string, fallback = "fornecedor") {
  return slugify(value) || fallback;
}
