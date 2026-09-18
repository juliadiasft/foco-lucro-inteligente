// Tema claro e escuro da Central.
//
// O CSS dos dois temas já existia desde o começo em src/styles.css — o bloco
// `.dark` está lá, completo. O que não existia era alguém para ligar a classe:
// nenhuma linha do sistema escrevia `dark` no <html>, então o tema escuro era
// código morto. Quem preferia escuro via o app claro e pronto.
//
// São TRÊS estados, e não dois. "Sistema" é o padrão e é o que a maioria quer:
// o celular já decide isso de noite, e um app que ignora essa decisão é um app
// que brilha na cara de quem está deitado. Claro e escuro são a escolha
// explícita de quem não quer seguir o sistema.

export const TEMAS = ["sistema", "claro", "escuro"] as const;
export type Tema = (typeof TEMAS)[number];

export const TEMA_PADRAO: Tema = "sistema";

/** A chave no armazenamento do navegador. Fica aqui para o script do <head> usar a mesma. */
export const CHAVE_DO_TEMA = "central-tema";

export function ehTema(valor: unknown): valor is Tema {
  return typeof valor === "string" && (TEMAS as readonly string[]).includes(valor);
}

/**
 * Se o tema escolhido resulta em escuro agora.
 *
 * `preferenciaDoSistema` é o que o `prefers-color-scheme` diz. Recebe de fora
 * para esta função continuar pura — é o que permite testá-la sem navegador.
 */
export function ficaEscuro(tema: Tema, preferenciaDoSistema: boolean) {
  if (tema === "escuro") return true;
  if (tema === "claro") return false;
  return preferenciaDoSistema;
}

/** O rótulo que a pessoa lê na tela. */
export const NOME_DO_TEMA: Record<Tema, string> = {
  sistema: "Como no celular",
  claro: "Claro",
  escuro: "Escuro",
};

export const EXPLICACAO_DO_TEMA: Record<Tema, string> = {
  sistema: "Acompanha o modo noturno do seu aparelho",
  claro: "Sempre claro, mesmo de noite",
  escuro: "Sempre escuro, cansa menos a vista no escuro",
};

/**
 * O script que roda no <head>, antes de qualquer pixel aparecer.
 *
 * Sem ele o app pinta claro, o React acorda e troca para escuro — e a pessoa
 * leva um flash branco na cara toda vez que abre. Por isso é texto puro
 * injetado no HTML, e não um efeito de componente: efeito roda tarde demais.
 *
 * Erro aqui não pode derrubar a página: se o navegador bloquear o
 * armazenamento (janela anônima, cookies desligados), o catch deixa no padrão
 * do sistema e a vida segue.
 */
export const SCRIPT_DO_TEMA = `(function(){try{
var t=localStorage.getItem(${JSON.stringify(CHAVE_DO_TEMA)})||${JSON.stringify(TEMA_PADRAO)};
var escuro=t==="escuro"||(t===${JSON.stringify(TEMA_PADRAO)}&&window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle("dark",escuro);
document.documentElement.style.colorScheme=escuro?"dark":"light";
}catch(e){}})();`;
