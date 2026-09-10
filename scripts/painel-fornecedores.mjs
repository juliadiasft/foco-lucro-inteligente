// Gera o painel da prospecção de fornecedores pet a partir da planilha.
//
//   node scripts/painel-fornecedores.mjs
//
// Lê o CSV do Desktop e escreve painel-fornecedores.html ao lado dele. Os dados
// vão embutidos no arquivo: abre com dois cliques, funciona sem internet e sem
// servidor, e não depende de a planilha continuar no mesmo lugar.
//
// Rodar de novo depois de cada rodada de enriquecimento ou de cada dia de
// ligação atualiza o painel inteiro. É esse o "automatizado": um comando, e o
// painel reflete a planilha como ela está agora.
//
// A planilha continua sendo a fonte da verdade — é lá que ela anota "liguei,
// falei com fulano". O painel só lê. Nunca escreve. Se o painel e a planilha
// discordarem, a planilha está certa e o painel está velho.
//
// SOBRE E-MAIL, porque a pergunta vai voltar: não tem. A Receita tirou o
// e-mail dos Dados Abertos, e nenhuma das fontes públicas devolve — testado em
// brasilapi, minhareceita.org, publica.cnpj.ws e receitaws, doze empresas,
// zero e-mails. A página de CNPJ da Breela também não tem: mostra sócios e
// capital social. Telefone tem em dez de doze. É por telefone e WhatsApp que
// o contato acontece, e é isso que o painel prepara.
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

// Duas listas, o mesmo painel:
//
//   node scripts/painel-fornecedores.mjs             -> fornecedores
//   node scripts/painel-fornecedores.mjs petshops    -> pet shops
//
// São os dois lados do balcão e o trabalho com eles é o mesmo: filtrar,
// escolher quem vale a ligação, e abrir a conversa. Um painel só, com o
// título e o texto trocados, em vez de dois arquivos que vão divergir.
const LISTAS = {
  fornecedores: {
    csv: "C:/Users/julia/OneDrive/Desktop/fornecedores-petshop.csv",
    html: "C:/Users/julia/OneDrive/Desktop/painel-fornecedores.html",
    titulo: "Prospecção de fornecedores pet",
    quem: "empresas",
    modelo:
      "Oi! Aqui é a Julia, da Central do Comerciante.\n\n" +
      "Estou montando uma vitrine online de fornecedores de pet shop e queria a {empresa} nela. " +
      "É gratuito para o fornecedor: você publica seu catálogo e os pet shops de {cidade} e região " +
      "encontram vocês na hora de comprar.\n\n" +
      "Posso te mandar o link para dar uma olhada?",
  },
  petshops: {
    csv: "C:/Users/julia/OneDrive/Desktop/comerciantes-petshop.csv",
    html: "C:/Users/julia/OneDrive/Desktop/painel-comerciantes.html",
    titulo: "Prospecção de pet shops",
    quem: "pet shops",
    // A primeira conversa com pet shop não vende nada — pergunta. A resposta
    // é o que diz quais distribuidores realmente entregam naquela cidade, e
    // dá a frase que abre a porta com eles depois.
    modelo:
      "Oi! Aqui é a Julia, da Central do Comerciante.\n\n" +
      "Estou montando uma ferramenta para pet shop comparar preço de fornecedor, e queria te fazer " +
      "duas perguntas rápidas sobre a {empresa}: de quem vocês compram ração hoje? E os acessórios, " +
      "coleira, caminha?\n\n" +
      "É rápido, e quando ficar pronto eu te aviso primeiro.",
  },
};
const QUAL = (process.argv[2] || "fornecedores").toLowerCase();
const LISTA = LISTAS[QUAL];
if (!LISTA) {
  console.error(`Nao conheco a lista "${QUAL}". Use: ${Object.keys(LISTAS).join(" ou ")}.`);
  process.exit(1);
}
const PLANILHA = LISTA.csv;
const DESTINO = LISTA.html;

// A meta declarada: 50 fornecedores e 50 comerciantes de pet até o fim de 2026.
const META_FORNECEDORES = 50;
// E o marco que vem muito antes: com 3 a 5 catálogos que se sobrepõem a
// comparação de preço já mostra alguma coisa. É esse número que diz quando dá
// para começar a vender para comerciante, e ele está a semanas, não a meses.
const MARCO_COMPARACAO = 5;

function separarLinha(linha) {
  const campos = [];
  let atual = "";
  let dentroDeAspas = false;
  for (let i = 0; i < linha.length; i += 1) {
    const c = linha[i];
    if (c === '"') {
      if (dentroDeAspas && linha[i + 1] === '"') {
        atual += '"';
        i += 1;
      } else dentroDeAspas = !dentroDeAspas;
    } else if (c === "," && !dentroDeAspas) {
      campos.push(atual);
      atual = "";
    } else atual += c;
  }
  campos.push(atual);
  return campos;
}

let bruto;
try {
  bruto = await readFile(PLANILHA, "utf8");
} catch {
  console.error(`Nao achei a planilha em ${PLANILHA}.`);
  console.error(`Rode antes: node scripts/coletar-${QUAL === "petshops" ? "petshops" : "fornecedores-pet"}.mjs`);
  process.exit(1);
}

const linhas = bruto
  .replace(/^\ufeff/, "")
  .trim()
  .split(/\r?\n/);
const cabecalho = separarLinha(linhas[0]);
const col = (nome) => cabecalho.indexOf(nome);

const iRazao = col("Razao social");
const iCnpj = col("CNPJ");
const iCidade = col("Cidade");
const iUf = col("UF");
const iTel = col("Telefone");
const iEmail = col("Email");
const iSituacao = col("Situacao na Receita");
const iRamo = col("Ramo principal");
const iFornece = col("Fornece");
const iConfere =
  col("Confere na Receita") >= 0 ? col("Confere na Receita") : col("Atacado de racao");
const iStatus = col("Status do contato");
const iCadastrou = col("Cadastrou na Central");
const iVitrine = col("Publicou vitrine");
const iSugere = col("Nome sugere pet");
const iMatriz = col("Matriz ou filial");
const iQuantos = col("Enderecos da empresa");

// Colunas enxutas, nesta ordem — o HTML depende dela.
const registros = linhas.slice(1).map((linha) => {
  const c = separarLinha(linha);
  const pega = (i) => (i >= 0 ? (c[i] || "").trim() : "");
  const situacao = pega(iSituacao);
  const telefone = pega(iTel);
  const digitos = telefone.replace(/\D/g, "");
  // Celular tem 11 dígitos e o nono na frente do número. É o que tem chance de
  // ter WhatsApp — mandar mensagem para fixo não chega em lugar nenhum.
  const celular = digitos.length === 11 && digitos[2] === "9" ? digitos : "";
  return [
    pega(iRazao),
    pega(iCidade),
    pega(iUf),
    telefone,
    pega(iEmail),
    pega(iFornece) || "racao",
    pega(iConfere),
    pega(iStatus) || "a contatar",
    pega(iCadastrou).toLowerCase() === "sim" ? 1 : 0,
    pega(iVitrine).toLowerCase() === "sim" ? 1 : 0,
    // "Baixada" e "Inapta" na Receita significam empresa que não existe mais ou
    // está irregular. Ligar para ela é ligação perdida. Sem esta marca o painel
    // contaria empresa morta como oportunidade — e o número de cima, que é o
    // que orienta o dia, ficaria mentindo para cima.
    /ativa/i.test(situacao) ? 1 : situacao ? 0 : -1,
    pega(iSugere) === "sim" ? 1 : 0,
    celular,
    pega(iCnpj),
    pega(iRamo),
    pega(iMatriz) || "unica",
    Number(pega(iQuantos)) || 1,
  ];
});

// Dicionário para as colunas que se repetem.
//
// Medido no painel de pet shops: a descrição do ramo ocupava 9,9 MB para UM
// único valor distinto, repetido 117 mil vezes. Somando ramo, "fornece",
// status, cidade e UF, eram 17 dos 31 MB do arquivo — texto igual copiado
// linha a linha. Trocando cada um por um número que aponta para uma lista,
// isso vira alguns kilobytes.
//
// O ganho não é estético: 31 MB é um arquivo que demora a abrir no navegador
// e que o OneDrive sincroniza inteiro a cada atualização.
const DICIONARIOS = [1, 2, 5, 6, 7, 14, 15]; // cidade, uf, fornece, confere, status, ramo, matriz
const tabelas = new Map();
for (const coluna of DICIONARIOS) {
  const valores = [...new Set(registros.map((r) => r[coluna]))];
  const indice = new Map(valores.map((v, i) => [v, i]));
  tabelas.set(coluna, { valores, indice });
  for (const r of registros) r[coluna] = indice.get(r[coluna]);
}

const dados = JSON.stringify(registros);
const dicionarios = JSON.stringify(
  Object.fromEntries([...tabelas].map(([coluna, t]) => [coluna, t.valores])),
);

const html = `<title>${LISTA.titulo} — Central do Comerciante</title>
<style>
  :root {
    color-scheme: light;
    --fundo: #f6f7f5;
    --cartao: #ffffff;
    --tinta: #1a2430;
    --tinta2: #5b6875;
    --tinta3: #8b96a2;
    --linha: #e4e8e4;
    /* Verde da Central. O painel usa uma cor só para grandeza: barra maior =
       número maior, e nada mais precisa ser decodificado. */
    --verde: #1a7a49;
    --verde-claro: #7cc39c;
    --verde-fraco: #e6f2eb;
    --cinza-barra: #c8d0d6;
    --zap: #128c4a;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--fundo); color: var(--tinta);
    font: 14px/1.5 -apple-system, "Segoe UI", Roboto, system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .envelope { max-width: 1240px; margin: 0 auto; padding: 26px 20px 64px; }
  header h1 { font-size: 21px; margin: 0 0 2px; letter-spacing: -0.01em; }
  header p { margin: 0; color: var(--tinta2); font-size: 13px; }
  .cartao {
    background: var(--cartao); border: 1px solid var(--linha);
    border-radius: 12px; padding: 18px 20px;
  }
  h2 { font-size: 13px; font-weight: 600; margin: 0 0 14px; letter-spacing: 0.02em;
       text-transform: uppercase; color: var(--tinta2); }
  .grade { display: grid; gap: 14px; }
  @media (min-width: 940px) { .duas { grid-template-columns: 1fr 1fr; } }

  /* --- filtros --- */
  .filtros { margin: 18px 0 16px; padding: 14px 16px 12px;
    background: var(--cartao); border: 1px solid var(--linha); border-radius: 12px; }
  .campos { display: grid; gap: 10px 14px; grid-template-columns: repeat(auto-fit, minmax(168px, 1fr)); }
  .campo { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .campo > span { font-size: 11px; color: var(--tinta2); text-transform: uppercase; letter-spacing: .03em; }
  select, input[type=search], textarea {
    font: inherit; font-size: 13px; padding: 7px 9px; width: 100%;
    border: 1px solid var(--linha); border-radius: 8px; background: #fff; color: var(--tinta);
  }
  select:focus, input:focus, textarea:focus { outline: 2px solid var(--verde); outline-offset: 1px; }
  .rodape-filtros { display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
    margin-top: 12px; padding-top: 11px; border-top: 1px solid var(--linha); }
  .resultado { font-size: 13px; color: var(--tinta2); }
  .resultado b { color: var(--verde); font-size: 15px; }
  button {
    font: inherit; font-size: 12px; padding: 7px 12px; cursor: pointer;
    border: 1px solid var(--linha); background: #fff; border-radius: 8px; color: var(--tinta2);
  }
  button:hover { border-color: var(--verde); color: var(--verde); }
  .rodape-filtros .direita { margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; }

  /* --- numeros grandes --- */
  .placar { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
  .num { font-size: 29px; font-weight: 680; letter-spacing: -0.02em; line-height: 1.1; }
  .num small { font-size: 14px; font-weight: 500; color: var(--tinta3); }
  .rotulo { font-size: 12px; color: var(--tinta2); margin-top: 3px; }
  .destaque { border-color: var(--verde-claro); background: var(--verde-fraco); }
  .destaque .num { color: var(--verde); }

  /* --- barras --- */
  .barra-linha { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; margin-bottom: 11px; }
  .barra-nome { font-size: 13px; }
  .barra-valor { font-size: 13px; font-variant-numeric: tabular-nums; color: var(--tinta2); }
  .trilho { grid-column: 1 / -1; height: 8px; background: #eef1ee; border-radius: 4px; overflow: hidden; }
  .preenche { height: 100%; background: var(--verde); border-radius: 4px; transition: width .35s ease; }
  .preenche.fraco { background: var(--verde-claro); }
  .preenche.cinza { background: var(--cinza-barra); }
  .clicavel { cursor: pointer; }
  .clicavel:hover .barra-nome { color: var(--verde); }

  /* --- funil --- */
  .etapa { display: flex; align-items: center; gap: 12px; padding: 9px 0; border-bottom: 1px dashed var(--linha); }
  .etapa:last-child { border-bottom: 0; }
  .etapa-nome { flex: 1; font-size: 13px; }
  .etapa-num { font-variant-numeric: tabular-nums; font-weight: 620; font-size: 15px; min-width: 62px; text-align: right; }
  .etapa-pct { font-size: 12px; color: var(--tinta3); min-width: 52px; text-align: right; }

  /* --- mensagem --- */
  .mensagem { margin-top: 14px; }
  .mensagem textarea { min-height: 96px; resize: vertical; line-height: 1.55; }
  .dica { font-size: 12px; color: var(--tinta3); margin: 8px 0 0; }
  .dica code { background: var(--verde-fraco); color: var(--verde); padding: 1px 5px; border-radius: 4px; }

  /* --- tabela --- */
  .rolagem { overflow-x: auto; margin: 0 -20px; padding: 0 20px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; min-width: 900px; }
  th {
    text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em;
    color: var(--tinta2); font-weight: 600; padding: 0 10px 9px; white-space: nowrap;
    border-bottom: 1px solid var(--linha); cursor: pointer; user-select: none;
  }
  th:hover { color: var(--verde); }
  th[aria-sort] { color: var(--verde); }
  td { padding: 9px 10px; border-bottom: 1px solid #f1f3f1; vertical-align: top; }
  tr:hover td { background: #fafbfa; }
  td a.tel { color: var(--verde); text-decoration: none; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td a.tel:hover { text-decoration: underline; }
  .acoes { display: flex; gap: 6px; white-space: nowrap; }
  .acoes a, .acoes button {
    font-size: 11px; padding: 4px 9px; border-radius: 6px; text-decoration: none;
    border: 1px solid var(--linha); color: var(--tinta2); background: #fff; line-height: 1.7;
  }
  .acoes a.zap { background: var(--zap); border-color: var(--zap); color: #fff; font-weight: 600; }
  .acoes a.zap:hover { filter: brightness(1.08); }
  .marca {
    display: inline-block; font-size: 11px; padding: 2px 7px; border-radius: 999px;
    background: var(--verde-fraco); color: var(--verde); white-space: nowrap;
  }
  .marca.fraca { background: #f0f2f0; color: var(--tinta2); }
  .vazio { padding: 28px 0; text-align: center; color: var(--tinta3); }

  /* --- alternador tabela / quadro --- */
  .abas { display: inline-flex; gap: 2px; padding: 3px; background: #eef1ee; border-radius: 9px; }
  .abas button { border: 0; background: transparent; padding: 6px 14px; border-radius: 7px; font-size: 13px; }
  .abas button[aria-selected="true"] { background: #fff; color: var(--verde); font-weight: 600;
    box-shadow: 0 1px 2px rgba(0,0,0,.06); }

  /* --- quadro --- */
  .quadro { display: grid; gap: 12px; grid-template-columns: repeat(5, minmax(210px, 1fr));
    overflow-x: auto; padding-bottom: 6px; }
  @media (max-width: 1100px) { .quadro { grid-template-columns: repeat(5, 240px); } }
  .coluna { background: #f2f4f2; border-radius: 12px; padding: 10px; min-height: 220px;
    display: flex; flex-direction: column; }
  .coluna.recebendo { background: var(--verde-fraco); outline: 2px dashed var(--verde-claro); outline-offset: -3px; }
  .coluna h3 { margin: 2px 4px 10px; font-size: 12px; text-transform: uppercase; letter-spacing: .03em;
    color: var(--tinta2); display: flex; justify-content: space-between; align-items: center; gap: 6px; }
  .coluna h3 b { font-size: 15px; color: var(--tinta); font-variant-numeric: tabular-nums; }
  .cartoes { display: flex; flex-direction: column; gap: 7px; overflow-y: auto; max-height: 62vh; }
  .cartao-emp { background: #fff; border: 1px solid var(--linha); border-radius: 9px; padding: 9px 10px;
    cursor: grab; font-size: 12.5px; line-height: 1.4; }
  .cartao-emp:active { cursor: grabbing; }
  .cartao-emp.arrastando { opacity: .4; }
  .cartao-emp .nome { font-weight: 600; display: block; margin-bottom: 2px; }
  .cartao-emp .onde { color: var(--tinta3); font-size: 11.5px; }
  .cartao-emp .acoes { margin-top: 7px; }
  .cartao-emp .acoes a { font-size: 10.5px; padding: 3px 7px; }
  .mais { text-align: center; font-size: 11.5px; color: var(--tinta3); padding: 8px 0 2px; }
  .salvo { font-size: 12px; color: var(--verde); }
  footer { margin-top: 22px; font-size: 12px; color: var(--tinta3); line-height: 1.7; }
  .aviso { margin-top: 14px; padding: 12px 14px; border-radius: 10px;
    background: #fff8e8; border: 1px solid #f0dfb8; color: #6b5420; font-size: 12.5px; line-height: 1.6; }
</style>

<div class="envelope">
  <header>
    <h1>${LISTA.titulo}</h1>
    <p id="carimbo"></p>
  </header>

  <div class="filtros">
    <div class="campos">
      <label class="campo"><span>Estado</span>
        <select id="f-uf"><option value="">Brasil inteiro</option></select></label>
      <label class="campo"><span>Cidade</span>
        <select id="f-cidade"><option value="">Todas</option></select></label>
      <label class="campo"><span>Fornece</span>
        <select id="f-prateleira"><option value="">Tudo</option></select></label>
      <label class="campo"><span>Confere na Receita</span>
        <select id="f-confere">
          <option value="">Qualquer</option>
          <option value="principal">Só atividade principal</option>
          <option value="secundario">Só secundária</option>
          <option value="pendente">Ainda não conferido</option>
        </select></label>
      <label class="campo"><span>Nome</span>
        <select id="f-sinal">
          <option value="">Todos</option>
          <option value="sim">Só nome de pet</option>
          <option value="nao">Só os outros</option>
        </select></label>
      <label class="campo"><span>Contato</span>
        <select id="f-contato">
          <option value="">Qualquer</option>
          <option value="zap">Tem WhatsApp</option>
          <option value="email">Tem e-mail</option>
          <option value="zap+email">Tem WhatsApp e e-mail</option>
          <option value="tel">Tem telefone</option>
          <option value="sem">Sem telefone ainda</option>
        </select></label>
      <label class="campo"><span>Na Receita</span>
        <select id="f-situacao">
          <option value="">Qualquer</option>
          <option value="ativa">Só ativas</option>
          <option value="morta">Baixadas e inaptas</option>
          <option value="pendente">Não conferidas</option>
        </select></label>
      <label class="campo"><span>Status do contato</span>
        <select id="f-status"><option value="">Qualquer</option></select></label>
      <label class="campo"><span>Matriz ou filial</span>
        <select id="f-matriz">
          <option value="">Todas</option>
          <option value="decide">Quem decide (única ou matriz)</option>
          <option value="unica">Só endereço único</option>
          <option value="matriz">Só matriz de rede</option>
          <option value="filial">Só filiais</option>
        </select></label>
      <label class="campo" style="grid-column: span 2"><span>Buscar</span>
        <input type="search" id="f-busca" placeholder="Nome, cidade ou CNPJ" /></label>
    </div>
    <div class="rodape-filtros">
      <span class="resultado" id="resultado"></span>
      <span class="direita">
        <button id="limpar">Limpar filtros</button>
        <button id="copiar-tel">Copiar telefones</button>
        <button id="copiar-email">Copiar e-mails</button>
        <button id="baixar">Baixar esta lista (CSV)</button>
      </span>
    </div>
  </div>

  <div class="placar" id="placar"></div>

  <section class="cartao mensagem">
    <h2>Mensagem do primeiro contato</h2>
    <label class="campo" style="margin-bottom:10px"><span>Assunto do e-mail</span>
      <input type="text" id="assunto" /></label>
    <textarea id="modelo"></textarea>
    <p class="dica">
      Escreva do seu jeito. <code>{empresa}</code> vira o nome da empresa e
      <code>{cidade}</code> vira a cidade em cada mensagem. O botão verde da
      tabela abre o WhatsApp já com esse texto escrito — você só confere e envia.
    </p>
  </section>

  <div class="grade duas" style="margin-top:14px">
    <section class="cartao">
      <h2>Da lista até a vitrine</h2>
      <div id="funil"></div>
    </section>
    <section class="cartao">
      <h2>Confere na Receita</h2>
      <div id="confere"></div>
      <p style="font-size:12px;color:var(--tinta3);margin:14px 0 0">
        “Principal” é quem abastece pet shop como atividade principal — é onde a
        ligação rende mais. “Secundária” tem o CNAE pendurado no cadastro: pode
        ser fornecedor de verdade, pode ser supermercado.
      </p>
    </section>
  </div>

  <div class="grade duas" style="margin-top:14px">
    <section class="cartao">
      <h2>Que prateleira abastece <span style="text-transform:none;font-weight:400;color:var(--tinta3)">— clique para filtrar</span></h2>
      <div id="prateleiras"></div>
    </section>
    <section class="cartao">
      <h2>Onde estão <span style="text-transform:none;font-weight:400;color:var(--tinta3)">— clique para filtrar</span></h2>
      <div id="estados"></div>
    </section>
  </div>

  <section class="cartao" style="margin-top:14px">
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:14px">
      <h2 style="margin:0">Fila de contato <span id="quantos-tabela" style="text-transform:none;font-weight:400;color:var(--tinta3)"></span></h2>
      <div class="abas" role="tablist" style="margin-left:auto">
        <button id="aba-tabela" role="tab" aria-selected="true">Lista</button>
        <button id="aba-quadro" role="tab" aria-selected="false">Quadro</button>
      </div>
    </div>

    <div id="vista-tabela">
      <div class="rolagem">
        <table>
          <thead><tr id="cabecalho-tabela"></tr></thead>
          <tbody id="corpo-tabela"></tbody>
        </table>
      </div>
      <p id="aviso-tabela" style="font-size:12px;color:var(--tinta3);margin:14px 0 0"></p>
    </div>

    <div id="vista-quadro" hidden>
      <div class="quadro" id="quadro"></div>
      <p style="font-size:12px;color:var(--tinta3);margin:14px 0 0">
        Arraste o cartão para a coluna seguinte conforme a conversa anda. O que
        você mover fica guardado neste navegador na hora — mas a planilha não
        muda sozinha. Quando terminar o dia, clique em
        <strong>“Baixar planilha com o que mudei”</strong> e troque o arquivo do
        Desktop pelo que baixou. <span id="pendentes-quadro" class="salvo"></span>
      </p>
      <p style="margin:10px 0 0">
        <button id="baixar-quadro">Baixar planilha com o que mudei</button>
        <button id="limpar-quadro">Descartar o que movi</button>
      </p>
    </div>
  </section>

  <div class="aviso">
    <strong>Sobre disparar tudo de uma vez:</strong> o WhatsApp bane número que
    manda mensagem igual para dezenas de desconhecidos, e uma vez banido você
    perde o número do negócio. Por isso o botão é um por vez — abre a conversa
    com o texto pronto, você confere e envia. Dá para fazer 40 ou 50 numa manhã.
    Para disparo em massa de verdade é preciso WhatsApp Business API com modelo
    aprovado, e aí é contratação, não script.
  </div>

  <footer>
    A planilha é a fonte da verdade — anote as ligações lá. Este painel só lê.<br />
    Para atualizar depois de uma rodada: <code>node scripts/painel-fornecedores.mjs</code>
  </footer>
</div>

<script>
const TABELAS = ${dicionarios};
const LINHAS = ${dados};
// Devolve o texto no lugar do número. Feito uma vez, ao abrir a página: daqui
// para a frente o resto do painel não sabe que houve dicionário.
for (const coluna in TABELAS) {
  const valores = TABELAS[coluna];
  for (const linha of LINHAS) linha[coluna] = valores[linha[coluna]];
}
const META = ${META_FORNECEDORES};
const MARCO = ${MARCO_COMPARACAO};
const GERADO = ${JSON.stringify(new Date().toLocaleString("pt-BR"))};

const RAZAO=0, CIDADE=1, UF=2, TEL=3, EMAIL=4, FORNECE=5, CONFERE=6, STATUS=7,
      CADASTROU=8, VITRINE=9, ATIVA=10, SUGERE=11, ZAP=12, CNPJ=13, RAMO=14,
      MATRIZ=15, QUANTOS=16;

const MODELO_PADRAO =
  "Oi! Aqui é a Julia, da Central do Comerciante.\\n\\n" +
  "Estou montando uma vitrine online de fornecedores de pet shop e queria a {empresa} nela. " +
  "É gratuito para o fornecedor: você publica seu catálogo e os pet shops de {cidade} e região " +
  "encontram vocês na hora de comprar.\\n\\n" +
  "Posso te mandar o link para dar uma olhada?";

document.getElementById("carimbo").textContent =
  LINHAS.length.toLocaleString("pt-BR") + " ${LISTA.quem} na lista · painel gerado em " + GERADO;

const prateleirasDe = (l) => (l[FORNECE] || "").split(";").map(s => s.trim()).filter(Boolean);

const filtros = { uf:"", cidade:"", prateleira:"", confere:"", sinal:"", contato:"", situacao:"", status:"", matriz:"", busca:"" };

function opcoes(id, valores, primeira) {
  const sel = document.getElementById(id);
  const atual = sel.value;
  sel.innerHTML = '<option value="">' + primeira + '</option>';
  for (const v of valores) {
    const o = document.createElement("option");
    o.value = v; o.textContent = v;
    sel.appendChild(o);
  }
  if (valores.includes(atual)) sel.value = atual;
}
opcoes("f-uf", [...new Set(LINHAS.map(l => l[UF]).filter(Boolean))].sort(), "Brasil inteiro");
opcoes("f-prateleira", [...new Set(LINHAS.flatMap(prateleirasDe))].sort(), "Tudo");
opcoes("f-status", [...new Set(LINHAS.map(l => l[STATUS]).filter(Boolean))].sort(), "Qualquer");

// A lista de cidades acompanha o estado escolhido. Com o Brasil inteiro seriam
// milhares de opções e o campo viraria inútil.
function atualizarCidades() {
  const base = filtros.uf ? LINHAS.filter(l => l[UF] === filtros.uf) : [];
  opcoes("f-cidade", [...new Set(base.map(l => l[CIDADE]).filter(Boolean))].sort(),
    filtros.uf ? "Todas as cidades" : "Escolha um estado antes");
  document.getElementById("f-cidade").disabled = !filtros.uf;
}
atualizarCidades();

function filtrar() {
  const busca = filtros.busca.toLowerCase().replace(/[^\\w\\sà-ú]/gi, "");
  return LINHAS.filter(l => {
    if (filtros.uf && l[UF] !== filtros.uf) return false;
    if (filtros.cidade && l[CIDADE] !== filtros.cidade) return false;
    if (filtros.prateleira && !prateleirasDe(l).includes(filtros.prateleira)) return false;
    if (filtros.confere === "pendente" ? l[CONFERE] : filtros.confere && l[CONFERE] !== filtros.confere) return false;
    if (filtros.sinal === "sim" && !l[SUGERE]) return false;
    if (filtros.sinal === "nao" && l[SUGERE]) return false;
    if (filtros.contato === "zap" && !l[ZAP]) return false;
    if (filtros.contato === "email" && !l[EMAIL]) return false;
    if (filtros.contato === "zap+email" && !(l[ZAP] && l[EMAIL])) return false;
    if (filtros.contato === "tel" && !l[TEL]) return false;
    if (filtros.contato === "sem" && l[TEL]) return false;
    if (filtros.situacao === "ativa" && l[ATIVA] !== 1) return false;
    if (filtros.situacao === "morta" && l[ATIVA] !== 0) return false;
    if (filtros.situacao === "pendente" && l[ATIVA] !== -1) return false;
    if (filtros.status && l[STATUS] !== filtros.status) return false;
    // "Quem decide" é o atalho que importa: tira as filiais e deixa quem manda
    // na compra. Uma filial da Petz traz o telefone do call center da matriz —
    // ligar nas 365 é ligar 365 vezes no mesmo lugar. Já o franqueado tem CNPJ
    // próprio e entra como "unica", então ele continua na lista e é contatado
    // um por um. É por isso que a marca existe em vez de a filial ser apagada:
    // a decisão é da Julia, caso a caso.
    if (filtros.matriz === "decide" && l[MATRIZ] === "filial") return false;
    if (filtros.matriz && filtros.matriz !== "decide" && l[MATRIZ] !== filtros.matriz) return false;
    if (busca) {
      const alvo = (l[RAZAO] + " " + l[CIDADE] + " " + l[CNPJ]).toLowerCase().replace(/[^\\w\\sà-ú]/gi, "");
      if (!alvo.includes(busca)) return false;
    }
    return true;
  });
}

const n = (v) => v.toLocaleString("pt-BR");
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
const escapar = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));

function desenharPlacar(f) {
  const comTel = f.filter(l => l[TEL]).length;
  const comZap = f.filter(l => l[ZAP]).length;
  const comEmail = f.filter(l => l[EMAIL]).length;
  const cadastrou = f.filter(l => l[CADASTROU]).length;
  const vitrine = f.filter(l => l[VITRINE]).length;
  // A única conta do painel que decide o dia: tem telefone, a empresa está
  // ativa na Receita, e ninguém falou com ela ainda.
  const prontos = f.filter(l => l[TEL] && l[ATIVA] !== 0 && l[STATUS] === "a contatar").length;

  const cartoes = [
    { num: n(f.length), rotulo: "empresas no filtro" },
    { num: n(comTel), rotulo: "com telefone (" + pct(comTel, f.length) + "%)" },
    { num: n(comZap), rotulo: "com WhatsApp provável" },
    { num: n(comEmail), rotulo: "com e-mail" },
    { num: n(prontos), rotulo: "prontas para falar hoje", destaque: true },
    { num: n(cadastrou) + "<small> / " + META + "</small>", rotulo: "cadastrados na Central" },
    { num: n(vitrine) + "<small> / " + MARCO + "</small>", rotulo: "vitrines no ar — o marco da comparação" },
  ];
  document.getElementById("placar").innerHTML = cartoes.map(c =>
    '<div class="cartao' + (c.destaque ? ' destaque' : '') + '">' +
      '<div class="num">' + c.num + '</div><div class="rotulo">' + c.rotulo + '</div></div>'
  ).join("");
}

function barras(alvo, itens, total, aoClicar) {
  const maior = Math.max(1, ...itens.map(i => i[1]));
  const el = document.getElementById(alvo);
  el.innerHTML = itens.length ? itens.map(([nome, valor, classe]) =>
    '<div class="barra-linha' + (aoClicar ? ' clicavel' : '') + '" data-valor="' + escapar(nome) + '">' +
    '<div class="barra-nome">' + escapar(nome) + '</div>' +
    '<div class="barra-valor">' + n(valor) + (total ? ' · ' + pct(valor, total) + '%' : '') + '</div>' +
    '<div class="trilho"><div class="preenche ' + (classe || '') + '" style="width:' +
      (valor / maior * 100) + '%"></div></div></div>'
  ).join("") : '<p class="vazio">Nada com esses filtros.</p>';
  if (aoClicar) el.onclick = (e) => {
    const linha = e.target.closest(".barra-linha");
    if (linha) aoClicar(linha.dataset.valor);
  };
}

function desenharPrateleiras(f) {
  const contagem = {};
  for (const l of f) for (const p of prateleirasDe(l)) contagem[p] = (contagem[p] || 0) + 1;
  barras("prateleiras", Object.entries(contagem).sort((a, b) => b[1] - a[1]), f.length, (v) => {
    filtros.prateleira = filtros.prateleira === v ? "" : v;
    document.getElementById("f-prateleira").value = filtros.prateleira;
    redesenhar();
  });
}

function desenharEstados(f) {
  const contagem = {};
  for (const l of f) if (l[UF]) contagem[l[UF]] = (contagem[l[UF]] || 0) + 1;
  const ordenados = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
  const topo = ordenados.slice(0, 12);
  const resto = ordenados.slice(12).reduce((s, x) => s + x[1], 0);
  if (resto) topo.push(["outros " + (ordenados.length - 12) + " estados", resto]);
  barras("estados", topo, f.length, (v) => {
    if (v.startsWith("outros")) return;
    filtros.uf = filtros.uf === v ? "" : v;
    filtros.cidade = "";
    document.getElementById("f-uf").value = filtros.uf;
    atualizarCidades();
    redesenhar();
  });
}

function desenharConfere(f) {
  // Escala, não categorias: principal vale mais que secundário, que vale mais
  // que "não tem". Por isso é um verde que vai clareando até o cinza, e não
  // três cores diferentes que obrigam a consultar legenda.
  const grupos = [
    ["Principal", l => l[CONFERE] === "principal", ""],
    ["Secundária", l => l[CONFERE] === "secundario", "fraco"],
    ["Nenhum CNAE de pet", l => l[CONFERE] === "nao tem", "cinza"],
    ["Ainda não conferido", l => !l[CONFERE], "cinza"],
  ];
  barras("confere", grupos.map(([nome, teste, classe]) => [nome, f.filter(teste).length, classe]), f.length);
}

function desenharFunil(f) {
  const etapas = [
    ["Na lista", f.length],
    ["Com telefone", f.filter(l => l[TEL]).length],
    ["Contatadas", f.filter(l => l[STATUS] && l[STATUS] !== "a contatar").length],
    ["Cadastradas na Central", f.filter(l => l[CADASTROU]).length],
    ["Com vitrine no ar", f.filter(l => l[VITRINE]).length],
  ];
  const topo = etapas[0][1] || 1;
  document.getElementById("funil").innerHTML = etapas.map(([nome, valor], i) =>
    '<div class="etapa"><div class="etapa-nome">' + nome + '</div>' +
    '<div class="etapa-num">' + n(valor) + '</div>' +
    '<div class="etapa-pct">' + (i ? pct(valor, topo) + '%' : '') + '</div></div>'
  ).join("");
}

// --- contato ---
function mensagemPara(l) {
  return (document.getElementById("modelo").value || MODELO_PADRAO)
    .replaceAll("{empresa}", l[RAZAO])
    .replaceAll("{cidade}", l[CIDADE] || "sua região");
}
const linkZap = (l) => "https://wa.me/55" + l[ZAP] + "?text=" + encodeURIComponent(mensagemPara(l));

// O mesmo texto serve para os dois canais. O e-mail leva assunto; o WhatsApp
// nao tem onde por assunto e por isso ele fica de fora do corpo.
const linkEmail = (l) =>
  "mailto:" + l[EMAIL] +
  "?subject=" + encodeURIComponent((document.getElementById("assunto").value || ASSUNTO_PADRAO).replaceAll("{empresa}", l[RAZAO])) +
  "&body=" + encodeURIComponent(mensagemPara(l));

// --- tabela ---
const COLUNAS_TABELA = [
  ["Empresa", RAZAO], ["Cidade", CIDADE], ["UF", UF],
  ["Telefone", TEL], ["E-mail", EMAIL], ["Fornece", FORNECE], ["Contato", -1],
];
let ordem = { coluna: RAZAO, desc: false };

document.getElementById("cabecalho-tabela").innerHTML =
  COLUNAS_TABELA.map(([nome, idx]) => '<th data-col="' + idx + '">' + nome + '</th>').join("");
document.getElementById("cabecalho-tabela").addEventListener("click", (e) => {
  const th = e.target.closest("th");
  if (!th || Number(th.dataset.col) < 0) return;
  const c = Number(th.dataset.col);
  ordem = { coluna: c, desc: ordem.coluna === c ? !ordem.desc : false };
  redesenhar();
});

function ordenar(fila) {
  const peso = { principal: 0, secundario: 1, "": 2, "nao tem": 3 };
  return fila.sort((a, b) => {
    if (ordem.coluna === RAZAO && !ordem.desc) {
      // Sem ordem escolhida: primeiro quem tem WhatsApp, depois quem é
      // atividade principal, depois quem tem nome de pet. É a ordem em que a
      // conversa tem mais chance de acontecer e de valer a pena.
      if (!!b[ZAP] !== !!a[ZAP]) return (b[ZAP] ? 1 : 0) - (a[ZAP] ? 1 : 0);
      const d = (peso[a[CONFERE]] ?? 2) - (peso[b[CONFERE]] ?? 2);
      if (d) return d;
      if (b[SUGERE] !== a[SUGERE]) return b[SUGERE] - a[SUGERE];
    }
    const va = String(a[ordem.coluna] ?? ""), vb = String(b[ordem.coluna] ?? "");
    return ordem.desc ? vb.localeCompare(va, "pt-BR") : va.localeCompare(vb, "pt-BR");
  });
}

let filaAtual = [];

function desenharTabela(f) {
  // A tabela é a fila do dia: quem dá para contatar agora. Quem não tem
  // telefone não dá para chamar, e quem está baixada na Receita não existe.
  filaAtual = ordenar(f.filter(l => l[TEL] && l[ATIVA] !== 0));
  const mostrar = filaAtual.slice(0, 300);

  document.getElementById("quantos-tabela").textContent =
    "— " + n(filaAtual.length) + (filaAtual.length === 1 ? " empresa" : " empresas") + " com telefone e ativas";
  document.getElementById("aviso-tabela").textContent = filaAtual.length > 300
    ? "Mostrando as 300 primeiras. Use os filtros para chegar em quem você quer falar hoje."
    : "";

  document.getElementById("corpo-tabela").innerHTML = mostrar.length ? mostrar.map((l, i) =>
    '<tr><td>' + escapar(l[RAZAO]) +
      (l[RAMO] ? '<div style="font-size:11px;color:var(--tinta3);margin-top:2px">' + escapar(l[RAMO]) + '</div>' : '') +
    '</td><td>' + escapar(l[CIDADE]) + '</td><td>' + l[UF] + '</td>' +
    '<td><a class="tel" href="tel:' + l[TEL].replace(/\\D/g, "") + '">' + escapar(l[TEL]) + '</a></td>' +
    '<td>' + prateleirasDe(l).map(p => '<span class="marca fraca">' + escapar(p) + '</span>').join(" ") + '</td>' +

    '<td><div class="acoes">' +
      (l[ZAP] ? '<a class="zap" target="_blank" rel="noopener" data-zap="' + i + '">WhatsApp</a>' : '') +
      (l[EMAIL] ? '<a data-email="' + i + '">E-mail</a>' : '') +
      '<button data-copiar="' + i + '">Copiar msg</button>' +
    '</div></td></tr>'
  ).join("") : '<tr><td colspan="7" class="vazio">Ninguém com telefone nesses filtros. Rode o enriquecer-telefones, ou afrouxe os filtros.</td></tr>';

  // O link do WhatsApp é montado na hora do clique, e não ao desenhar a
  // tabela: assim ele usa a mensagem como ela está no campo agora, mesmo que
  // ela tenha sido editada depois que a lista apareceu.
  document.getElementById("corpo-tabela").onclick = (e) => {
    const zap = e.target.closest("[data-zap]");
    if (zap) { zap.href = linkZap(mostrar[Number(zap.dataset.zap)]); return; }
    const email = e.target.closest("[data-email]");
    if (email) { email.href = linkEmail(mostrar[Number(email.dataset.email)]); return; }
    const copiar = e.target.closest("[data-copiar]");
    if (copiar) {
      navigator.clipboard.writeText(mensagemPara(mostrar[Number(copiar.dataset.copiar)]));
      const antes = copiar.textContent;
      copiar.textContent = "Copiado";
      setTimeout(() => { copiar.textContent = antes; }, 1400);
    }
  };

  for (const th of document.querySelectorAll("th")) {
    if (Number(th.dataset.col) === ordem.coluna) th.setAttribute("aria-sort", ordem.desc ? "descending" : "ascending");
    else th.removeAttribute("aria-sort");
  }
}

// --- o quadro ---
//
// As cinco etapas por que passa uma prospecção, na ordem. O nome de cada uma é
// o que vai gravado na coluna "Status do contato" da planilha, para que o
// quadro e a planilha falem a mesma língua.
const ETAPAS = [
  { id: "a contatar", nome: "A contatar" },
  { id: "contatado", nome: "Contatado" },
  { id: "respondeu", nome: "Respondeu" },
  { id: "cadastrou", nome: "Cadastrou" },
  { id: "vitrine no ar", nome: "Vitrine no ar" },
];

// O que ela moveu, guardado por CNPJ.
//
// Fica no navegador, não na planilha: o painel é um arquivo aberto com dois
// cliques, sem servidor por trás, e não tem como escrever no CSV sozinho.
// Então grava aqui na hora — nada se perde se ela fechar a aba — e o botão de
// baixar gera a planilha atualizada quando ela quiser.
//
// A chave inclui o nome da lista para os dois painéis não se misturarem.
const CHAVE = "central-prospeccao-" + ${JSON.stringify(QUAL)};
let movidos = {};
try {
  movidos = JSON.parse(localStorage.getItem(CHAVE) || "{}");
} catch {
  movidos = {};
}

const etapaDe = (l) => movidos[l[CNPJ]] || l[STATUS] || "a contatar";

function guardarMovidos() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(movidos));
  } catch {
    /* navegador sem espaço ou em modo privado: o quadro ainda funciona nesta sessão */
  }
  const quantos = Object.keys(movidos).length;
  document.getElementById("pendentes-quadro").textContent = quantos
    ? n(quantos) + (quantos === 1 ? " empresa movida" : " empresas movidas") + " esperando ir para a planilha."
    : "";
}

// Quantos cartões cada coluna desenha.
//
// Sem teto, filtrar "Brasil inteiro" tentaria montar 117 mil cartões e o
// navegador travaria. O quadro é para trabalhar o dia — não para olhar o país.
const CARTOES_POR_COLUNA = 60;

function desenharQuadro(f) {
  const fila = f.filter((l) => l[TEL] && l[ATIVA] !== 0);
  const porEtapa = new Map(ETAPAS.map((e) => [e.id, []]));
  for (const l of fila) {
    const etapa = etapaDe(l);
    if (porEtapa.has(etapa)) porEtapa.get(etapa).push(l);
    else porEtapa.get("a contatar").push(l);
  }

  document.getElementById("quadro").innerHTML = ETAPAS.map((etapa) => {
    const lista = ordenar(porEtapa.get(etapa.id));
    const mostrar = lista.slice(0, CARTOES_POR_COLUNA);
    const cartoes = mostrar
      .map((l) => {
        const rede = l[QUANTOS] > 1 ? " · " + l[MATRIZ] + " de " + l[QUANTOS] : "";
        return (
          '<div class="cartao-emp" draggable="true" data-cnpj="' + l[CNPJ] + '">' +
          '<span class="nome">' + escapar(l[RAZAO].slice(0, 44)) + "</span>" +
          '<span class="onde">' + escapar(l[CIDADE]) + "/" + l[UF] + escapar(rede) + "</span>" +
          '<div class="acoes">' +
          (l[ZAP] ? '<a class="zap" target="_blank" rel="noopener" data-zap-cnpj="' + l[CNPJ] + '">Zap</a>' : "") +
          (l[EMAIL] ? '<a data-email-cnpj="' + l[CNPJ] + '">E-mail</a>' : "") +
          "</div></div>"
        );
      })
      .join("");
    const sobrando = lista.length - mostrar.length;
    return (
      '<div class="coluna" data-etapa="' + etapa.id + '">' +
      "<h3>" + etapa.nome + "<b>" + n(lista.length) + "</b></h3>" +
      '<div class="cartoes">' + (cartoes || '<p class="mais">vazio</p>') + "</div>" +
      (sobrando > 0 ? '<p class="mais">+ ' + n(sobrando) + " sem caber aqui — filtre mais</p>" : "") +
      "</div>"
    );
  }).join("");
}

// Arrastar e soltar.
//
// Delegado no quadro inteiro, e não cartão por cartão: as colunas são
// redesenhadas a cada filtro, e ouvintes presos em cada cartão morreriam com
// eles. Aqui os ouvintes ficam no pai, que nunca é recriado.
const quadroEl = document.getElementById("quadro");
let arrastando = null;

quadroEl.addEventListener("dragstart", (e) => {
  const cartao = e.target.closest(".cartao-emp");
  if (!cartao) return;
  arrastando = cartao.dataset.cnpj;
  cartao.classList.add("arrastando");
  e.dataTransfer.effectAllowed = "move";
  // Alguns navegadores só iniciam o arraste se houver dados no evento.
  e.dataTransfer.setData("text/plain", arrastando);
});

quadroEl.addEventListener("dragend", (e) => {
  const cartao = e.target.closest(".cartao-emp");
  if (cartao) cartao.classList.remove("arrastando");
  for (const c of quadroEl.querySelectorAll(".coluna")) c.classList.remove("recebendo");
  arrastando = null;
});

quadroEl.addEventListener("dragover", (e) => {
  const coluna = e.target.closest(".coluna");
  if (!coluna || !arrastando) return;
  // Sem isto o navegador recusa a solta e o cartão volta para o lugar.
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  for (const c of quadroEl.querySelectorAll(".coluna")) c.classList.toggle("recebendo", c === coluna);
});

quadroEl.addEventListener("drop", (e) => {
  const coluna = e.target.closest(".coluna");
  const cnpj = arrastando || e.dataTransfer.getData("text/plain");
  if (!coluna || !cnpj) return;
  e.preventDefault();
  const etapa = coluna.dataset.etapa;
  const empresa = LINHAS.find((l) => l[CNPJ] === cnpj);
  // Voltar para "a contatar" apaga a marca em vez de gravar o estado inicial:
  // assim "desfazer" não conta como mudança pendente na planilha.
  if (empresa && etapa === (empresa[STATUS] || "a contatar")) delete movidos[cnpj];
  else movidos[cnpj] = etapa;
  guardarMovidos();
  redesenhar();
});

// Os botões dentro do cartão montam o link na hora do clique, igual à tabela.
quadroEl.addEventListener("click", (e) => {
  const zap = e.target.closest("[data-zap-cnpj]");
  if (zap) {
    const l = LINHAS.find((x) => x[CNPJ] === zap.dataset.zapCnpj);
    if (l) zap.href = linkZap(l);
    return;
  }
  const email = e.target.closest("[data-email-cnpj]");
  if (email) {
    const l = LINHAS.find((x) => x[CNPJ] === email.dataset.emailCnpj);
    if (l) email.href = linkEmail(l);
  }
});

// --- alternar as duas vistas ---
let vista = "tabela";
function trocarVista(qual) {
  vista = qual;
  document.getElementById("vista-tabela").hidden = qual !== "tabela";
  document.getElementById("vista-quadro").hidden = qual !== "quadro";
  document.getElementById("aba-tabela").setAttribute("aria-selected", String(qual === "tabela"));
  document.getElementById("aba-quadro").setAttribute("aria-selected", String(qual === "quadro"));
  redesenhar();
}
document.getElementById("aba-tabela").addEventListener("click", () => trocarVista("tabela"));
document.getElementById("aba-quadro").addEventListener("click", () => trocarVista("quadro"));

document.getElementById("limpar-quadro").addEventListener("click", () => {
  const quantos = Object.keys(movidos).length;
  if (!quantos) return;
  if (!confirm("Descartar as " + quantos + " movimentações que você fez? Isso não dá para desfazer.")) return;
  movidos = {};
  guardarMovidos();
  redesenhar();
});

function redesenhar() {
  const f = filtrar();
  document.getElementById("resultado").innerHTML =
    "<b>" + n(f.length) + "</b> de " + n(LINHAS.length) + " ${LISTA.quem}";
  desenharPlacar(f);
  desenharFunil(f);
  desenharConfere(f);
  desenharPrateleiras(f);
  desenharEstados(f);
  if (vista === "quadro") desenharQuadro(f);
  else desenharTabela(f);
}

// --- controles ---
for (const [id, chave] of [["f-uf","uf"], ["f-cidade","cidade"], ["f-prateleira","prateleira"],
                           ["f-confere","confere"], ["f-sinal","sinal"], ["f-contato","contato"],
                           ["f-situacao","situacao"], ["f-status","status"], ["f-matriz","matriz"]]) {
  document.getElementById(id).addEventListener("change", (e) => {
    filtros[chave] = e.target.value;
    if (chave === "uf") { filtros.cidade = ""; atualizarCidades(); }
    redesenhar();
  });
}
document.getElementById("f-busca").addEventListener("input", (e) => { filtros.busca = e.target.value; redesenhar(); });

document.getElementById("limpar").addEventListener("click", () => {
  Object.keys(filtros).forEach(k => filtros[k] = "");
  for (const id of ["f-uf","f-cidade","f-prateleira","f-confere","f-sinal","f-contato","f-situacao","f-status","f-matriz","f-busca"])
    document.getElementById(id).value = "";
  atualizarCidades();
  redesenhar();
});

document.getElementById("copiar-tel").addEventListener("click", (e) => {
  const nums = filaAtual.map(l => l[TEL]).join("\\n");
  navigator.clipboard.writeText(nums);
  e.target.textContent = filaAtual.length + " copiados";
  setTimeout(() => { e.target.textContent = "Copiar telefones"; }, 1600);
});

document.getElementById("copiar-email").addEventListener("click", (e) => {
  const lista = filaAtual.map(l => l[EMAIL]).filter(Boolean);
  navigator.clipboard.writeText(lista.join("; "));
  e.target.textContent = lista.length + " copiados";
  setTimeout(() => { e.target.textContent = "Copiar e-mails"; }, 1600);
});

document.getElementById("baixar").addEventListener("click", () => {
  const esc = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const cols = ["Razao social","CNPJ","Cidade","UF","Telefone","WhatsApp","Fornece","Confere na Receita","Ramo principal","Mensagem pronta"];
  const linhas = [cols.map(esc).join(",")].concat(filaAtual.map(l =>
    [l[RAZAO], l[CNPJ], l[CIDADE], l[UF], l[TEL], l[ZAP] ? "55" + l[ZAP] : "",
     l[FORNECE], l[CONFERE], l[RAMO], mensagemPara(l)].map(esc).join(",")));
  const blob = new Blob(["\\ufeff" + linhas.join("\\r\\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "contatos-filtrados.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

const ASSUNTO_PADRAO = "Central do Comerciante — parceria com a {empresa}";
document.getElementById("assunto").value = ASSUNTO_PADRAO;
document.getElementById("modelo").value = MODELO_PADRAO;
redesenhar();
</script>
`;

await writeFile(DESTINO, html, "utf8");

const comTel = registros.filter((r) => r[3]).length;
const comZap = registros.filter((r) => r[12]).length;
const ativas = registros.filter((r) => r[10] === 1).length;
console.log(`${registros.length} empresas · ${comTel} com telefone · ${comZap} com WhatsApp · ${ativas} ativas`);
console.log(`\nPainel: ${DESTINO}`);
console.log(`Abra com dois cliques. Para atualizar: node scripts/painel-fornecedores.mjs${QUAL === "petshops" ? " petshops" : ""}`);
