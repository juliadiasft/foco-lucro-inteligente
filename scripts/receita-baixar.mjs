// Monta as listas de prospecção a partir dos arquivos oficiais da Receita.
//
//   node scripts/receita-baixar.mjs
//
// POR QUE ISTO EXISTE. A primeira versão das listas saiu raspando as páginas
// públicas da Breela, e bateu em três paredes que não têm contorno:
//
//   - teto de 100 páginas por estado: 5.000 empresas e acabou;
//   - São Paulo, Minas e Bahia devolvem HTTP 500 permanente no CNAE de pet
//     shop — SP entregou 450 de 31.771, Minas 50 de 11.915, Bahia zero;
//   - telefone não vem na listagem, só na consulta um-a-um: 1,2s cada, e
//     113 mil pet shops dariam 38 horas.
//
// Os arquivos abertos da Receita são a fonte de tudo isso, sem teto e sem
// buraco — e trazem telefone e e-mail dentro. O que levaria 38 horas de
// consulta sai junto com o resto.
//
// COMO ELE NÃO ENTOPE O DISCO. São ~25 GB compactados e muito mais abertos.
// O script trata um arquivo por vez e nunca grava o CSV descompactado:
// `unzip -p` joga o conteúdo na saída padrão, a leitura é linha a linha, e só
// as empresas dos CNAEs que interessam ficam na memória. Terminado o arquivo,
// o .zip é apagado antes de baixar o próximo. O pico de disco é o tamanho de
// um arquivo, não o da base.
//
// A pasta de trabalho fica FORA do OneDrive de propósito: baixar 25 GB dentro
// dele mandaria tudo para a nuvem dela sem necessidade.
import { spawn } from "node:child_process";

import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";

import path from "node:path";
import process from "node:process";

const PASTA = "C:/Users/julia/dados-receita";
// NÃO é segredo, apesar de parecer um. É o código do link público que a
// Receita Federal publica para qualquer pessoa baixar os Dados Abertos do
// CNPJ — o mesmo que aparece na página deles e em dezenas de repositórios.
// Fica no código de propósito: guardá-lo numa variável de ambiente daria a
// entender que é credencial, e a próxima pessoa perderia tempo procurando
// onde configurar o que não precisa ser configurado.
const LINK_PUBLICO = "YggdBLfdninEJX9";
const HOST = "https://arquivos.receitafederal.gov.br/public.php/webdav";
const PARTES = 10;

// Cada CNAE e a prateleira que ele abastece. O 4789004 é o pet shop em si —
// o comerciante, que vai para a outra planilha.
const CNAES = {
  "4789004": { lista: "petshops", rotulo: "pet shop (comerciante)" },
  "4623109": { lista: "fornecedores", rotulo: "racao" },
  "4644302": { lista: "fornecedores", rotulo: "medicamento veterinario" },
  "1066000": { lista: "fornecedores", rotulo: "fabrica de racao" },
  "2122000": { lista: "fornecedores", rotulo: "fabrica de medicamento veterinario" },
  "4623101": { lista: "fornecedores", rotulo: "animais vivos" },
  "4649499": { lista: "fornecedores", rotulo: "acessorios (coleira, caminha, casinha)" },
  "4692300": { lista: "fornecedores", rotulo: "agropecuaria (higiene, areia, acessorio)" },
};

const SITUACAO = { 1: "Nula", 2: "Ativa", 3: "Suspensa", 4: "Inapta", 8: "Baixada" };

// A peneira grossa, usada antes de quebrar a linha em 30 campos.
//
// Ela olha o contexto do campo — aspas ou vírgula antes e depois — em vez de
// procurar o número solto na linha. Sem isso, "4789004" casaria com um pedaço
// de CNPJ, de CEP ou de telefone.
const PENEIRA = new RegExp(`[",](${Object.keys(CNAES).join("|")})[",]`);

// Só entra quem tem o CNAE como atividade PRINCIPAL.
//
// Esta linha é a diferença entre uma lista e um depósito. Contando também os
// secundários, o primeiro dos dez arquivos sozinho devolveu 405.987 empresas
// e 270.864 "pet shops" — o país inteiro daria 4 milhões, quando existem
// 113.585 pet shops de verdade. O excesso é a padaria, o supermercado e a
// loja de material de construção que deixaram o código pendurado no cadastro.
//
// Foi o mesmo lixo que apareceu na raspagem da Breela, agora em escala: lá
// eram "CABANAS RESTAURANTE" e "MINAS AUTO PECAS" no fim da lista.
//
// A atividade secundária ainda é anotada na coluna "Fornece" quando a empresa
// já entrou pelo principal — é informação útil sobre o que mais ela vende.
// O que ela não faz é colocar a empresa na lista.
const SO_ATIVIDADE_PRINCIPAL = true;

// --- utilidades ---

const mb = (n) => (n / 1048576).toFixed(0);
const agora = () => new Date().toLocaleTimeString("pt-BR");

async function existe(caminho) {
  try {
    return (await stat(caminho)).size;
  } catch {
    return 0;
  }
}

function rodar(comando, args, opcoes = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(comando, args, { stdio: ["ignore", "pipe", "pipe"], ...opcoes });
    let erro = "";
    p.stderr.on("data", (d) => (erro += d));
    p.on("error", reject);
    p.on("close", (codigo) =>
      codigo === 0 ? resolve() : reject(new Error(`${comando} saiu com ${codigo}: ${erro.slice(0, 300)}`)),
    );
    if (opcoes.aoSair) opcoes.aoSair(p);
  });
}

// Quanto o arquivo tem no servidor. É isso que diz se o que está no disco
// está inteiro ou pela metade.
async function tamanhoRemoto(arquivo) {
  const r = await fetch(`${HOST}/2026-08/${arquivo}`, {
    method: "HEAD",
    headers: {
      Authorization: "Basic " + Buffer.from(`${LINK_PUBLICO}:`).toString("base64"),
      "User-Agent": "Mozilla/5.0",
    },
    signal: AbortSignal.timeout(30000),
  });
  return Number(r.headers.get("content-length") || 0);
}

// Baixa com retomada: se a rodada anterior parou no meio, continua de onde
// estava em vez de recomeçar 2 GB. Numa conexão de 4 MB/s isso é a diferença
// entre perder nove minutos e perder nenhum.
//
// E confere o tamanho no fim. A versão anterior só olhava se o arquivo
// existia, e um zip de 208 MB interrompido no meio contava como pronto — o
// unzip morria com "End-of-central-directory signature not found" no segundo
// arquivo, depois de dez minutos de trabalho já feito. Existir não é estar
// inteiro.
async function baixar(arquivo) {
  const destino = path.join(PASTA, arquivo);
  const url = `${HOST}/2026-08/${arquivo}`;
  const esperado = await tamanhoRemoto(arquivo);
  const local = await existe(destino);

  if (esperado && local === esperado) {
    console.log(`  ja estava aqui, inteiro (${mb(local)} MB)`);
    return destino;
  }
  if (local > esperado && esperado) {
    // Maior que o remoto: é outra coisa, ou lixo. Recomeça limpo.
    console.log(`  arquivo local maior que o remoto — recomecando`);
    await rm(destino, { force: true });
  } else if (local) {
    console.log(`  retomando de ${mb(local)} MB de ${mb(esperado)} MB`);
  }

  const t0 = Date.now();
  await rodar("curl", [
    "-s",
    "-C",
    "-", // continua de onde parou
    "--retry",
    "8",
    "--retry-delay",
    "5",
    // Sem isto o curl so tenta de novo em erros que ele considera
    // "transitorios", e a conexao caindo no meio (erro 56) nao entra na lista:
    // ele desiste na hora. Foi o que derrubou a rodada depois de vinte e cinco
    // minutos de varredura ja feita.
    "--retry-all-errors",
    "--speed-limit",
    "1024",
    "--speed-time",
    "60",
    "-m",
    "3600",
    "-u",
    `${LINK_PUBLICO}:`,
    "-H",
    "User-Agent: Mozilla/5.0",
    "-o",
    destino,
    url,
  ]);
  const tamanho = await existe(destino);
  const seg = (Date.now() - t0) / 1000;
  if (esperado && tamanho !== esperado)
    throw new Error(`${arquivo} veio incompleto: ${mb(tamanho)} MB de ${mb(esperado)} MB`);
  console.log(`  baixado ${mb(tamanho)} MB em ${seg.toFixed(0)}s`);
  return destino;
}

// Lê o CSV de dentro do zip sem gravá-lo em lugar nenhum.
//
// Duas armadilhas aqui, as duas descobertas na marra:
//
// 1. ENCODING. A Receita entrega em latin1, não UTF-8. Lido como UTF-8,
//    "RAÇÕES NUTRIÇÃO" vira lixo — e é justamente o nome que a Julia vai ler
//    na hora de ligar. O TextDecoder("latin1") com `stream: true` atravessa
//    a fronteira dos chunks sem cortar caractere no meio.
//
// 2. MEMÓRIA. A primeira versão usava readline sobre a saída do unzip e morreu
//    em 18 segundos com 2 GB de heap: o descompactador despeja muito mais
//    rápido do que o filtro consome, e as linhas se empilhavam. `for await`
//    sobre o stream resolve de verdade — ele segura a torneira enquanto o
//    corpo do laço roda, então a memória fica no tamanho de um chunk, e não
//    do arquivo.
async function lerZipLinhaALinha(caminhoZip, aoLerLinha) {
  const p = spawn("unzip", ["-p", caminhoZip], { stdio: ["ignore", "pipe", "pipe"] });
  let erro = "";
  p.stderr.on("data", (d) => (erro += d));

  const decodificador = new TextDecoder("latin1");
  let resto = "";
  for await (const pedaco of p.stdout) {
    const texto = resto + decodificador.decode(pedaco, { stream: true });
    const linhas = texto.split("\n");
    // A última pode ter sido cortada no meio pelo fim do chunk: fica para a
    // próxima volta.
    resto = linhas.pop() ?? "";
    for (const linha of linhas) {
      if (linha) aoLerLinha(linha.endsWith("\r") ? linha.slice(0, -1) : linha);
    }
  }
  if (resto) aoLerLinha(resto.endsWith("\r") ? resto.slice(0, -1) : resto);

  const codigo = await new Promise((r) => p.on("close", r));
  if (codigo !== 0) throw new Error(`unzip saiu com ${codigo}: ${erro.slice(0, 300)}`);
}

// Separa os campos respeitando as aspas.
//
// Um `split(";")` simples parece bastar e não basta: 4.652 estabelecimentos
// têm ponto e vírgula DENTRO de um campo — quase sempre no complemento do
// endereço, coisa como "CASA; FUNDOS". Nesses, tudo desloca uma casa para a
// direita a partir dali, e o campo da UF acaba trazendo "CASA", "LOJA",
// "CENTRO" ou "JARDIM CEU AZUL". Telefone e e-mail vêm deslocados junto — e
// ninguém percebe, porque a linha continua parecendo uma linha.
//
// Custa mais que o split, mas só roda nas linhas que já passaram pela
// peneira: quatrocentas mil, não trezentos milhões.
function campos(linha) {
  const saida = [];
  let atual = "";
  let dentroDeAspas = false;
  for (let i = 0; i < linha.length; i += 1) {
    const c = linha[i];
    if (c === '"') dentroDeAspas = !dentroDeAspas;
    else if (c === ";" && !dentroDeAspas) {
      saida.push(atual);
      atual = "";
    } else atual += c;
  }
  saida.push(atual);
  return saida;
}

// Força uma cópia de verdade da string.
//
// Isto parece inútil e é o contrário: quando se guarda um pedaço de uma string
// grande, o V8 não copia os caracteres — ele cria uma fatia que aponta para o
// original e o mantém vivo inteiro. Guardar o nome de uma empresa segurava na
// memória o bloco de 64 KB do arquivo de onde a linha saiu. Com 148 mil
// empresas guardadas, isso vira nove gigabytes de arquivo preso por causa de
// alguns megabytes de nome, e o processo morre no meio da segunda etapa —
// depois de vinte e cinco minutos de trabalho já feito.
//
// Concatenar e recortar obriga o V8 a materializar os caracteres numa string
// nova e solta, e o bloco original pode finalmente ser liberado.
const copiar = (s) => (s ? (" " + s).slice(1) : "");

// --- tabelas de apoio ---

async function carregarApoio() {
  const municipios = new Map();
  await lerZipLinhaALinha(path.join(PASTA, "Municipios.zip"), (linha) => {
    const c = campos(linha);
    if (c.length >= 2) municipios.set(c[0], c[1]);
  });
  console.log(`${municipios.size} municipios carregados.\n`);
  return { municipios };
}

// --- o passo caro ---

const achados = new Map(); // cnpj basico+ordem+dv -> registro

async function varrerEstabelecimentos(municipios) {
  for (let i = 0; i < PARTES; i += 1) {
    const arquivo = `Estabelecimentos${i}.zip`;
    const caminho = path.join(PASTA, arquivo);
    console.log(`[${agora()}] ${arquivo} (${i + 1} de ${PARTES})`);

    await baixar(arquivo);

    let lidas = 0;
    let guardadas = 0;
    await lerZipLinhaALinha(caminho, (linha) => {
      lidas += 1;
      // Filtro barato antes do split: se nenhum dos códigos aparece na linha
      // crua, nem vale quebrar em 30 campos. São 60 milhões de linhas, e o
      // split em todas custaria horas.
      //
      // Uma regex com alternação em vez de oito `includes` seguidos: o motor
      // varre a linha uma vez procurando os oito ao mesmo tempo, em vez de
      // oito passadas completas. Em 60 milhões de linhas essa diferença é de
      // minutos por arquivo.
      if (!PENEIRA.test(linha)) return;

      const c = campos(linha);
      if (c.length < 28) return;

      const principal = (c[11] || "").padStart(7, "0");
      const secundarios = (c[12] || "").split(",").map((x) => x.trim().padStart(7, "0"));

      // O principal decide em qual lista a empresa entra.
      const doPrincipal = CNAES[principal];
      if (SO_ATIVIDADE_PRINCIPAL && !doPrincipal) return;

      // Só empresa ATIVA. Os arquivos da Receita guardam todo o histórico do
      // CNPJ — quem baixou em 2009 continua lá, com endereço e telefone de
      // 2009. Só o primeiro dos dez arquivos devolveu 148.149 estabelecimentos
      // com esses CNAEs como principal, o que daria quase 1,5 milhão no país
      // inteiro; os pet shops de verdade são 113.585. A diferença é cemitério.
      //
      // Empresa baixada não é prospecto: não atende o telefone e não compra
      // nada. Deixá-la na lista só faria a Julia gastar ligação para descobrir
      // isso uma por uma.
      if (SITUACAO[Number(c[5])] !== "Ativa") return;

      const prateleiras = [];
      let ehPetshop = false;
      let ehFornecedor = false;

      for (const [cnae, info] of Object.entries(CNAES)) {
        const temPrincipal = principal === cnae;
        const temSecundario = secundarios.includes(cnae);
        if (!temPrincipal && !temSecundario) continue;
        prateleiras.push(temPrincipal ? info.rotulo : `${info.rotulo} (secundaria)`);
        if (!SO_ATIVIDADE_PRINCIPAL || temPrincipal) {
          if (info.lista === "petshops") ehPetshop = true;
          else ehFornecedor = true;
        }
      }
      if (!ehPetshop && !ehFornecedor) return;
      const comoPrincipal = Boolean(doPrincipal);

      const cnpj = `${c[0]}${c[1]}${c[2]}`;
      const ddd1 = (c[21] || "").trim();
      const tel1 = (c[22] || "").trim();
      const ddd2 = (c[23] || "").trim();
      const tel2 = (c[24] || "").trim();

      achados.set(copiar(cnpj), {
        cnpj: copiar(cnpj),
        nomeFantasia: copiar((c[4] || "").trim()),
        situacao: SITUACAO[Number(c[5])] || "",
        cnaePrincipal: copiar(principal),
        uf: copiar((c[19] || "").trim()),
        // O nome do municipio vem da tabela de apoio, que ja e uma string
        // solta — nao precisa copiar, e todas as empresas da mesma cidade
        // compartilham a mesma.
        municipio: municipios.get((c[20] || "").trim()) || "",
        telefone1: ddd1 && tel1 ? `${ddd1}${tel1}` : "",
        telefone2: ddd2 && tel2 ? `${ddd2}${tel2}` : "",
        email: copiar((c[27] || "").trim().toLowerCase()),
        prateleiras,
        comoPrincipal,
        ehPetshop,
        ehFornecedor,
      });
      guardadas += 1;
    });

    console.log(
      `  ${lidas.toLocaleString("pt-BR")} linhas lidas, ${guardadas.toLocaleString("pt-BR")} guardadas · total ${achados.size.toLocaleString("pt-BR")}`,
    );
    // O zip sai antes do próximo entrar: o pico de disco fica sendo um
    // arquivo, e não vinte.
    await rm(caminho, { force: true });
    console.log(`  ${arquivo} apagado.\n`);
  }
}

// A razão social não está no arquivo de estabelecimentos — está no de
// empresas, ligada pelos oito primeiros dígitos do CNPJ. Sem esta segunda
// passada a planilha teria só o nome fantasia, que em boa parte vem vazio.
async function varrerEmpresas() {
  const precisamos = new Set([...achados.keys()].map((c) => c.slice(0, 8)));
  console.log(`Buscando a razao social de ${precisamos.size.toLocaleString("pt-BR")} empresas.\n`);
  const razoes = new Map();

  for (let i = 0; i < PARTES; i += 1) {
    const arquivo = `Empresas${i}.zip`;
    const caminho = path.join(PASTA, arquivo);
    console.log(`[${agora()}] ${arquivo} (${i + 1} de ${PARTES})`);
    await baixar(arquivo);

    await lerZipLinhaALinha(caminho, (linha) => {
      const fim = linha.indexOf('";"');
      if (fim < 0) return;
      const base = linha.slice(1, fim);
      if (!precisamos.has(base)) return;
      const c = campos(linha);
      if (c.length >= 2) razoes.set(copiar(base), copiar(c[1].trim()));
    });

    console.log(`  ${razoes.size.toLocaleString("pt-BR")} de ${precisamos.size.toLocaleString("pt-BR")} encontradas`);
    await rm(caminho, { force: true });
    console.log(`  ${arquivo} apagado.\n`);
  }
  return razoes;
}

// --- saída ---

const formatarCnpj = (d) =>
  `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;

// A Receita guarda telefone no formato de antes de 2016. Celular com dez
// dígitos não disca mais, e a regra da Anatel é fechada: todo celular ganhou
// um "9" na frente, e celular é o que começa com 6, 7, 8 ou 9 depois do DDD.
const formatarTelefone = (bruto) => {
  let d = (bruto || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!d) return "";
  if (d.length === 10 && "6789".includes(d[2])) d = d.slice(0, 2) + "9" + d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 9 || d.length === 8) return `(${d.slice(0, 2)}) ${d.slice(2)} (cadastro antigo)`;
  return `${d} (conferir)`;
};

const NOME_PET =
  /\bPET\b|PETS|ANIMAL|ANIMAIS|VETERIN|RACAO|RAÇÃO|AGROPEC|ZOO|\bCAO\b|CAES|CACHORR|GATO|BICHO|FOCINHO|AUAU|MIAU|CANIL|\bVET\b|AQUAR|PASSARO|AVIARIO/i;

const COLUNAS = [
  "Razao social",
  "Nome fantasia",
  "CNPJ",
  "Cidade",
  "UF",
  "Telefone",
  "Telefone 2",
  "Email",
  "Situacao na Receita",
  "Ramo principal",
  "Fornece",
  "Confere na Receita",
  "Nome sugere pet",
  "Status do contato",
  "Data do contato",
  "Quem falou",
  "Compra de quem",
  "Resposta",
  "Cadastrou na Central",
  "Publicou vitrine",
  "Itens no catalogo",
  "Observacoes",
];

const escapar = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

async function gravar(nome, registros, razoes, cnaes) {
  const destino = `C:/Users/julia/OneDrive/Desktop/${nome}`;

  // Preserva o que a Julia escreveu à mão: telefone que ela corrigiu, "liguei
  // terça, falei com o Marcos", o status do contato. Só as colunas que vêm da
  // Receita são sobrescritas.
  const anotado = new Map();
  try {
    const bruto = await readFile(destino, "utf8");
    const linhas = bruto.replace(/^\ufeff/, "").trim().split(/\r?\n/);
    const cab = linhas[0].split('","').map((c) => c.replace(/^"|"$/g, ""));
    const guardar = ["Status do contato", "Data do contato", "Quem falou", "Compra de quem",
                     "Resposta", "Cadastrou na Central", "Publicou vitrine", "Itens no catalogo", "Observacoes"];
    for (const linha of linhas.slice(1)) {
      const c = linha.split('","').map((x) => x.replace(/^"|"$/g, ""));
      const chave = (c[cab.indexOf("CNPJ")] || "").replace(/\D/g, "");
      if (chave.length !== 14) continue;
      const manter = {};
      let temAlgo = false;
      for (const col of guardar) {
        const i = cab.indexOf(col);
        const v = i >= 0 ? (c[i] || "").trim() : "";
        if (v && v !== "a contatar" && v !== "nao") temAlgo = true;
        if (v) manter[col] = v;
      }
      if (temAlgo) anotado.set(chave, manter);
    }
    if (anotado.size) console.log(`  ${anotado.size} linhas com anotacao sua foram preservadas.`);
  } catch {
    /* planilha nova */
  }

  const linhas = registros.map((r) => {
    const razao = razoes.get(r.cnpj.slice(0, 8)) || "";
    const nome = razao || r.nomeFantasia;
    const reg = Object.fromEntries(COLUNAS.map((c) => [c, ""]));
    reg["Razao social"] = razao;
    reg["Nome fantasia"] = r.nomeFantasia;
    reg["CNPJ"] = formatarCnpj(r.cnpj);
    reg["Cidade"] = r.municipio;
    reg["UF"] = r.uf;
    reg["Telefone"] = formatarTelefone(r.telefone1);
    reg["Telefone 2"] = formatarTelefone(r.telefone2);
    reg["Email"] = r.email;
    reg["Situacao na Receita"] = r.situacao;
    reg["Ramo principal"] = cnaes.get(r.cnaePrincipal) || "";
    reg["Fornece"] = r.prateleiras.join("; ");
    reg["Confere na Receita"] = r.comoPrincipal ? "principal" : "secundario";
    reg["Nome sugere pet"] = NOME_PET.test(`${razao} ${r.nomeFantasia}`) ? "sim" : "nao";
    reg["Status do contato"] = "a contatar";
    reg["Cadastrou na Central"] = "nao";
    reg["Publicou vitrine"] = "nao";
    Object.assign(reg, anotado.get(r.cnpj) || {});
    return reg;
  });

  linhas.sort(
    (a, b) =>
      a["UF"].localeCompare(b["UF"]) ||
      a["Cidade"].localeCompare(b["Cidade"]) ||
      a["Razao social"].localeCompare(b["Razao social"]),
  );

  const csv =
    "\ufeff" +
    [COLUNAS.map(escapar).join(","), ...linhas.map((r) => COLUNAS.map((c) => escapar(r[c])).join(","))].join("\r\n") +
    "\r\n";
  await writeFile(destino, csv, "utf8");

  const comTel = linhas.filter((r) => r["Telefone"]).length;
  const comEmail = linhas.filter((r) => r["Email"]).length;
  const ativas = linhas.filter((r) => r["Situacao na Receita"] === "Ativa").length;
  const principais = linhas.filter((r) => r["Confere na Receita"] === "principal").length;
  console.log(`  ${linhas.length.toLocaleString("pt-BR")} linhas`);
  console.log(`  ${comTel.toLocaleString("pt-BR")} com telefone · ${comEmail.toLocaleString("pt-BR")} com e-mail`);
  console.log(`  ${ativas.toLocaleString("pt-BR")} ativas · ${principais.toLocaleString("pt-BR")} com o CNAE como atividade principal`);
  console.log(`  -> ${destino}\n`);
}

// --- programa ---

await mkdir(PASTA, { recursive: true });
console.log(`Pasta de trabalho: ${PASTA}`);
console.log("Fora do OneDrive de proposito — sao dezenas de GB passando por aqui.\n");

for (const apoio of ["Municipios.zip", "Cnaes.zip"])
  if (!(await existe(path.join(PASTA, apoio)))) await baixar(apoio);

const { municipios } = await carregarApoio();

const cnaes = new Map();
await lerZipLinhaALinha(path.join(PASTA, "Cnaes.zip"), (linha) => {
  const c = campos(linha);
  if (c.length >= 2) cnaes.set(c[0], c[1]);
});

const inicio = Date.now();

// Ponto de retomada.
//
// A varredura dos estabelecimentos custa vinte e cinco minutos e trezentos
// milhoes de linhas. Quando a etapa seguinte falhava, tudo isso ia junto — e
// falhou quatro vezes ate aqui. Gravado em disco, um tropeco na segunda etapa
// custa a segunda etapa, e nao o dia inteiro.
const CHECKPOINT = path.join(PASTA, "achados.json");
if (await existe(CHECKPOINT)) {
  const salvos = JSON.parse(await readFile(CHECKPOINT, "utf8"));
  for (const r of salvos) achados.set(r.cnpj, r);
  console.log(`${achados.size.toLocaleString("pt-BR")} empresas retomadas do ponto salvo.
`);
} else {
  await varrerEstabelecimentos(municipios);
  await writeFile(CHECKPOINT, JSON.stringify([...achados.values()]), "utf8");
  console.log(`Ponto salvo: ${achados.size.toLocaleString("pt-BR")} empresas em achados.json
`);
}

const razoes = await varrerEmpresas();

console.log("--- Gravando as planilhas ---\n");
const todos = [...achados.values()];
console.log("Pet shops (comerciantes):");
await gravar("comerciantes-petshop.csv", todos.filter((r) => r.ehPetshop), razoes, cnaes);
console.log("Fornecedores:");
await gravar("fornecedores-petshop.csv", todos.filter((r) => r.ehFornecedor), razoes, cnaes);

console.log(`Terminado em ${((Date.now() - inicio) / 60000).toFixed(0)} minutos.`);
console.log("\nAgora os paineis:");
console.log("  node scripts/painel-fornecedores.mjs");
console.log("  node scripts/painel-fornecedores.mjs petshops");
process.exit(0);
