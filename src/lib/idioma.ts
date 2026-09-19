// Idioma do app: português, inglês e espanhol.
//
// Segue o molde do tema (lib/tema.ts): a escolha mora no aparelho, o padrão é
// português e um valor guardado que não reconhecemos é ignorado. O padrão NÃO
// segue o idioma do navegador de propósito: o produto é local (compara
// fornecedor da região, cadastro com CNPJ e PIX), e um comerciante brasileiro
// com o celular em inglês não pediu um app em inglês.
//
// Traduzir a tela não muda o produto: os dados, os preços e as regras
// continuam brasileiros. Operar em outro país é decisão separada.
//
// O português é a fonte da verdade. Cada chave nova nasce aqui, e os outros
// dois dicionários são `Record<Chave, string>`: esquecer uma tradução não
// compila.

export const IDIOMAS = ["pt", "en", "es"] as const;
export type Idioma = (typeof IDIOMAS)[number];

export const IDIOMA_PADRAO: Idioma = "pt";

/** A chave no armazenamento do navegador. */
export const CHAVE_DO_IDIOMA = "central-idioma";

/** O nome de cada idioma, sempre no próprio idioma: quem está perdido lê o dele. */
export const NOME_DO_IDIOMA: Record<Idioma, string> = {
  pt: "Português",
  en: "English",
  es: "Español",
};

/** O valor de `lang` no <html>. */
export const LANG_HTML: Record<Idioma, string> = { pt: "pt-BR", en: "en", es: "es" };

export function ehIdioma(valor: unknown): valor is Idioma {
  return typeof valor === "string" && (IDIOMAS as readonly string[]).includes(valor);
}

const PT = {
  // Navegação do comerciante
  "nav.painel": "Painel",
  "nav.comprar": "Comprar",
  "nav.produtos": "Produtos",
  "nav.assistente": "Assistente",
  "nav.assistenteLongo": "Assistente de Lucro",
  "nav.mais": "Mais",
  "nav.ondeComprar": "Onde comprar",
  "nav.fornecedores": "Fornecedores",
  "nav.orcamentos": "Orçamentos",
  "nav.pedidos": "Pedidos",
  "nav.conversas": "Conversas",
  "nav.financeiro": "Contas a pagar",
  "nav.relatorios": "Relatórios",
  "nav.calculadora": "Calculadora de margem",
  "nav.conquistas": "Conquistas",
  "nav.trazerDados": "Trazer meus dados",
  "nav.registrarVenda": "Registrar venda",
  "nav.historicoVendas": "Histórico de vendas",
  "nav.equipe": "Equipe",
  "nav.plano": "Plano e assinatura",
  "nav.configuracoes": "Configurações",
  "nav.sair": "Sair",
  "nav.principal": "Navegação principal",
  "nav.marca": "Central do Comerciante",
  // Navegação do fornecedor
  "forn.vitrine": "Minha vitrine",
  "forn.catalogo": "Meu catálogo",
  "forn.catalogoCurto": "Catálogo",
  "forn.importar": "Importar planilha",
  "forn.consultor": "Consultor de Vendas",
  "forn.contasReceber": "Contas a receber",
  "forn.desempenho": "Posição e relatórios",
  "forn.rotulo": "Fornecedor",
  // Tela Mais
  "mais.titulo": "Mais",
  "mais.grupoDinheiro": "Dinheiro",
  "mais.grupoDados": "Seus dados",
  "mais.grupoConta": "Conta",
  "mais.grupoNegocio": "Seu negócio",
  // Configurações
  "cfg.titulo": "Configurações",
  "cfg.subtituloEmpresa": "Aparência, idioma, dados e metas da empresa",
  "cfg.subtituloAparelho": "Como a Central se comporta neste aparelho",
  "cfg.idiomaTitulo": "Idioma",
  "cfg.idiomaAjuda":
    "Muda os textos do app. Preços, fornecedores e regras continuam os do Brasil. A escolha vale só neste aparelho.",
  "cfg.temaTitulo": "Aparência",
  "cfg.temaAjuda":
    "Escuro cansa menos a vista no estoque ou de noite. A escolha vale só neste aparelho.",
  "cfg.temaSistema": "Como no celular",
  "cfg.temaSistemaAjuda": "Acompanha o modo noturno do seu aparelho",
  "cfg.temaClaro": "Claro",
  "cfg.temaClaroAjuda": "Sempre claro, mesmo de noite",
  "cfg.temaEscuro": "Escuro",
  "cfg.temaEscuroAjuda": "Sempre escuro, cansa menos a vista no escuro",
  "cfg.temaGrupo": "Tema do app",
  "cfg.nomeEmpresa": "Nome da empresa *",
  "cfg.documento": "Documento usado no cadastro",
  "cfg.documentoAjuda": "Protegido e vinculado ao teste grátis. Não pode ser alterado.",
  "cfg.cnpj": "CNPJ",
  "cfg.telefone": "Telefone",
  "cfg.tipoNegocio": "Tipo de negócio",
  "cfg.metaMensal": "Meta mensal (R$)",
  "cfg.ticket": "Ticket desejado (R$)",
  "cfg.salvar": "Salvar alterações",
  "cfg.salvando": "Salvando...",
  "cfg.salvo": "Configurações salvas!",
  "cfg.alertasTitulo": "Alertas no celular",
  "cfg.alertasAjuda":
    "Receba oportunidades de fornecedores mesmo quando a Central estiver fechada.",
  "cfg.alertasAtivar": "Ativar alertas",
  "cfg.alertasDesativar": "Desativar neste aparelho",
  "cfg.avisoFiscalTitulo": "Aviso fiscal",
  "cfg.avisoFiscal":
    "Este sistema controla vendas, estoque e lucro, mas não substitui a emissão de NF-e ou NFC-e em emissor autorizado.",
} as const;

export type Chave = keyof typeof PT;

const EN: Record<Chave, string> = {
  "nav.painel": "Home",
  "nav.comprar": "Buy",
  "nav.produtos": "Products",
  "nav.assistente": "Assistant",
  "nav.assistenteLongo": "Profit Assistant",
  "nav.mais": "More",
  "nav.ondeComprar": "Where to buy",
  "nav.fornecedores": "Suppliers",
  "nav.orcamentos": "Quotes",
  "nav.pedidos": "Orders",
  "nav.conversas": "Chats",
  "nav.financeiro": "Bills to pay",
  "nav.relatorios": "Reports",
  "nav.calculadora": "Margin calculator",
  "nav.conquistas": "Achievements",
  "nav.trazerDados": "Bring my data",
  "nav.registrarVenda": "Record a sale",
  "nav.historicoVendas": "Sales history",
  "nav.equipe": "Team",
  "nav.plano": "Plan and billing",
  "nav.configuracoes": "Settings",
  "nav.sair": "Sign out",
  "nav.principal": "Main navigation",
  "nav.marca": "Central do Comerciante",
  "forn.vitrine": "My storefront",
  "forn.catalogo": "My catalog",
  "forn.catalogoCurto": "Catalog",
  "forn.importar": "Import spreadsheet",
  "forn.consultor": "Sales Advisor",
  "forn.contasReceber": "Bills to receive",
  "forn.desempenho": "Ranking and reports",
  "forn.rotulo": "Supplier",
  "mais.titulo": "More",
  "mais.grupoDinheiro": "Money",
  "mais.grupoDados": "Your data",
  "mais.grupoConta": "Account",
  "mais.grupoNegocio": "Your business",
  "cfg.titulo": "Settings",
  "cfg.subtituloEmpresa": "Appearance, language, company data and goals",
  "cfg.subtituloAparelho": "How Central behaves on this device",
  "cfg.idiomaTitulo": "Language",
  "cfg.idiomaAjuda":
    "Changes the app's text. Prices, suppliers and rules stay Brazilian. This choice applies only to this device.",
  "cfg.temaTitulo": "Appearance",
  "cfg.temaAjuda":
    "Dark is easier on the eyes in the stockroom or at night. This choice applies only to this device.",
  "cfg.temaSistema": "Same as phone",
  "cfg.temaSistemaAjuda": "Follows your device's night mode",
  "cfg.temaClaro": "Light",
  "cfg.temaClaroAjuda": "Always light, even at night",
  "cfg.temaEscuro": "Dark",
  "cfg.temaEscuroAjuda": "Always dark, easier on the eyes in the dark",
  "cfg.temaGrupo": "App theme",
  "cfg.nomeEmpresa": "Company name *",
  "cfg.documento": "Document used at sign-up",
  "cfg.documentoAjuda": "Protected and tied to the free trial. It cannot be changed.",
  "cfg.cnpj": "CNPJ (company tax ID)",
  "cfg.telefone": "Phone",
  "cfg.tipoNegocio": "Type of business",
  "cfg.metaMensal": "Monthly goal (R$)",
  "cfg.ticket": "Target average ticket (R$)",
  "cfg.salvar": "Save changes",
  "cfg.salvando": "Saving...",
  "cfg.salvo": "Settings saved!",
  "cfg.alertasTitulo": "Phone alerts",
  "cfg.alertasAjuda": "Get supplier opportunities even when Central is closed.",
  "cfg.alertasAtivar": "Turn on alerts",
  "cfg.alertasDesativar": "Turn off on this device",
  "cfg.avisoFiscalTitulo": "Tax notice",
  "cfg.avisoFiscal":
    "This system tracks sales, inventory and profit, but does not replace issuing an NF-e or NFC-e (Brazilian tax invoice) through an authorized issuer.",
};

const ES: Record<Chave, string> = {
  "nav.painel": "Inicio",
  "nav.comprar": "Comprar",
  "nav.produtos": "Productos",
  "nav.assistente": "Asistente",
  "nav.assistenteLongo": "Asistente de Ganancias",
  "nav.mais": "Más",
  "nav.ondeComprar": "Dónde comprar",
  "nav.fornecedores": "Proveedores",
  "nav.orcamentos": "Presupuestos",
  "nav.pedidos": "Pedidos",
  "nav.conversas": "Conversaciones",
  "nav.financeiro": "Cuentas por pagar",
  "nav.relatorios": "Informes",
  "nav.calculadora": "Calculadora de margen",
  "nav.conquistas": "Logros",
  "nav.trazerDados": "Traer mis datos",
  "nav.registrarVenda": "Registrar venta",
  "nav.historicoVendas": "Historial de ventas",
  "nav.equipe": "Equipo",
  "nav.plano": "Plan y suscripción",
  "nav.configuracoes": "Configuración",
  "nav.sair": "Salir",
  "nav.principal": "Navegación principal",
  "nav.marca": "Central do Comerciante",
  "forn.vitrine": "Mi vitrina",
  "forn.catalogo": "Mi catálogo",
  "forn.catalogoCurto": "Catálogo",
  "forn.importar": "Importar planilla",
  "forn.consultor": "Asesor de Ventas",
  "forn.contasReceber": "Cuentas por cobrar",
  "forn.desempenho": "Posición e informes",
  "forn.rotulo": "Proveedor",
  "mais.titulo": "Más",
  "mais.grupoDinheiro": "Dinero",
  "mais.grupoDados": "Tus datos",
  "mais.grupoConta": "Cuenta",
  "mais.grupoNegocio": "Tu negocio",
  "cfg.titulo": "Configuración",
  "cfg.subtituloEmpresa": "Apariencia, idioma, datos y metas de la empresa",
  "cfg.subtituloAparelho": "Cómo se comporta Central en este dispositivo",
  "cfg.idiomaTitulo": "Idioma",
  "cfg.idiomaAjuda":
    "Cambia los textos de la app. Los precios, proveedores y reglas siguen siendo los de Brasil. La elección vale solo en este dispositivo.",
  "cfg.temaTitulo": "Apariencia",
  "cfg.temaAjuda":
    "El modo oscuro cansa menos la vista en el depósito o de noche. La elección vale solo en este dispositivo.",
  "cfg.temaSistema": "Como en el celular",
  "cfg.temaSistemaAjuda": "Sigue el modo nocturno de tu dispositivo",
  "cfg.temaClaro": "Claro",
  "cfg.temaClaroAjuda": "Siempre claro, incluso de noche",
  "cfg.temaEscuro": "Oscuro",
  "cfg.temaEscuroAjuda": "Siempre oscuro, cansa menos la vista en la oscuridad",
  "cfg.temaGrupo": "Tema de la app",
  "cfg.nomeEmpresa": "Nombre de la empresa *",
  "cfg.documento": "Documento usado en el registro",
  "cfg.documentoAjuda": "Protegido y vinculado a la prueba gratis. No se puede cambiar.",
  "cfg.cnpj": "CNPJ (identificación fiscal)",
  "cfg.telefone": "Teléfono",
  "cfg.tipoNegocio": "Tipo de negocio",
  "cfg.metaMensal": "Meta mensual (R$)",
  "cfg.ticket": "Ticket promedio deseado (R$)",
  "cfg.salvar": "Guardar cambios",
  "cfg.salvando": "Guardando...",
  "cfg.salvo": "¡Configuración guardada!",
  "cfg.alertasTitulo": "Alertas en el celular",
  "cfg.alertasAjuda": "Recibe oportunidades de proveedores aunque Central esté cerrada.",
  "cfg.alertasAtivar": "Activar alertas",
  "cfg.alertasDesativar": "Desactivar en este dispositivo",
  "cfg.avisoFiscalTitulo": "Aviso fiscal",
  "cfg.avisoFiscal":
    "Este sistema controla ventas, inventario y ganancias, pero no reemplaza la emisión de NF-e o NFC-e (factura fiscal brasileña) en un emisor autorizado.",
};

export const DICIONARIOS: Record<Idioma, Record<Chave, string>> = { pt: PT, en: EN, es: ES };

/** O texto de `chave` no idioma pedido. Idioma desconhecido cai no português. */
export function traduzir(idioma: Idioma, chave: Chave): string {
  return (DICIONARIOS[idioma] ?? PT)[chave];
}

/**
 * O script do <head>: escreve `lang` no <html> antes de qualquer pixel, pelo
 * mesmo motivo do script do tema — leitor de tela e tradutor automático do
 * navegador olham esse atributo, e efeito de componente roda tarde demais.
 */
export const SCRIPT_DO_IDIOMA = `(function(){try{
var l=localStorage.getItem(${JSON.stringify(CHAVE_DO_IDIOMA)});
var m=${JSON.stringify(LANG_HTML)};
if(l&&m[l])document.documentElement.lang=m[l];
}catch(e){}})();`;
