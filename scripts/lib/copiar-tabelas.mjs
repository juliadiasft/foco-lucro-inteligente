// Logica da copia de dados entre dois bancos, separada do driver.
//
// Recebe qualquer objeto com .query(sql, params) — o cliente `pg` em
// producao, o PGlite nos testes. Assim a mesma logica que roda na migracao
// de verdade e a que os testes exercitam.

// Tabelas que o destino preenche sozinho e que nao devem ser copiadas.
const IGNORAR = new Set(["app_migrations"]);

// Uma unica instrucao com milhares de linhas estoura o limite de parametros
// do Postgres (65535).
const LOTE = 200;

/** Lista as tabelas de dados do esquema public. */
export async function listarTabelas(cliente) {
  const resultado = await cliente.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'`,
  );
  return resultado.rows.map((row) => row.table_name).filter((nome) => !IGNORAR.has(nome));
}

/**
 * Ordem de insercao que respeita as chaves estrangeiras, calculada a partir
 * do proprio banco — e nao de uma lista escrita a mao que envelheceria a cada
 * migracao nova.
 */
export async function ordenarPorDependencia(cliente, tabelas, aviso = console.warn) {
  const dependencias = (
    await cliente.query(
      `SELECT tc.table_name AS filho, ccu.table_name AS pai
         FROM information_schema.table_constraints tc
         JOIN information_schema.constraint_column_usage ccu
           ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'`,
    )
  ).rows;

  const pais = new Map(tabelas.map((nome) => [nome, new Set()]));
  for (const { filho, pai } of dependencias) {
    if (filho === pai) continue; // auto-referencia nao muda a ordem
    if (pais.has(filho) && pais.has(pai)) pais.get(filho).add(pai);
  }

  const ordem = [];
  const pendentes = new Set(tabelas);
  while (pendentes.size) {
    const prontas = [...pendentes]
      .filter((nome) => [...pais.get(nome)].every((pai) => !pendentes.has(pai)))
      .sort();
    if (!prontas.length) {
      aviso("Aviso: dependencia circular detectada, seguindo em ordem alfabetica.");
      ordem.push(...[...pendentes].sort());
      break;
    }
    ordem.push(...prontas);
    for (const nome of prontas) pendentes.delete(nome);
  }
  return ordem;
}

/**
 * Copia todas as tabelas da origem para o destino e devolve, por tabela,
 * quantas linhas existiam na origem e quantas existem no destino ao final.
 * Nunca escreve na origem; nunca apaga nada no destino.
 */
export async function copiarTabelas(fonte, alvo, { log = console.log } = {}) {
  const tabelas = await listarTabelas(fonte);
  const ordem = await ordenarPorDependencia(fonte, tabelas);
  const resumo = [];

  for (const tabela of ordem) {
    const dados = await fonte.query(`SELECT * FROM "${tabela}"`);
    if (!dados.rows.length) {
      resumo.push({ tabela, origem: 0, destino: 0 });
      log(`${tabela}: vazia`);
      continue;
    }

    const colunas = Object.keys(dados.rows[0]);
    const lista = colunas.map((coluna) => `"${coluna}"`).join(",");

    for (let inicio = 0; inicio < dados.rows.length; inicio += LOTE) {
      const fatia = dados.rows.slice(inicio, inicio + LOTE);
      const valores = [];
      const marcadores = fatia
        .map((linha, indiceLinha) => {
          const posicoes = colunas.map((coluna, indiceColuna) => {
            valores.push(linha[coluna]);
            return `$${indiceLinha * colunas.length + indiceColuna + 1}`;
          });
          return `(${posicoes.join(",")})`;
        })
        .join(",");
      await alvo.query(
        `INSERT INTO "${tabela}" (${lista}) VALUES ${marcadores} ON CONFLICT DO NOTHING`,
        valores,
      );
    }

    const conferencia = await alvo.query(`SELECT count(*)::int AS total FROM "${tabela}"`);
    const destino = Number(conferencia.rows[0].total);
    resumo.push({ tabela, origem: dados.rows.length, destino });
    log(`${tabela}: ${dados.rows.length} -> ${destino}`);
  }

  return resumo;
}

/** Le todas as tabelas para um objeto simples, pronto para virar JSON. */
export async function exportarParaObjeto(cliente, log = console.log) {
  const tabelas = (await listarTabelas(cliente)).sort();
  const dump = { geradoEm: new Date().toISOString(), tabelas: {} };
  let total = 0;
  for (const tabela of tabelas) {
    const linhas = (await cliente.query(`SELECT * FROM "${tabela}"`)).rows;
    dump.tabelas[tabela] = linhas;
    total += linhas.length;
    log(`${tabela}: ${linhas.length} linha(s)`);
  }
  return { dump, total };
}

/**
 * Devolve os dados de um arquivo de backup para um banco. A ordem vem das
 * chaves estrangeiras do banco de destino, nao da ordem do arquivo.
 */
export async function importarDeObjeto(alvo, dump, { log = console.log } = {}) {
  const presentes = new Set(await listarTabelas(alvo));
  const doArquivo = Object.keys(dump.tabelas).filter((nome) => presentes.has(nome));
  const ausentes = Object.keys(dump.tabelas).filter((nome) => !presentes.has(nome));
  if (ausentes.length) {
    log(
      `Ignorando ${ausentes.length} tabela(s) que nao existem no destino: ${ausentes.join(", ")}`,
    );
  }

  const ordem = await ordenarPorDependencia(alvo, doArquivo);
  const resumo = [];

  for (const tabela of ordem) {
    const linhas = dump.tabelas[tabela] || [];
    if (!linhas.length) {
      resumo.push({ tabela, origem: 0, destino: 0 });
      continue;
    }
    const colunas = Object.keys(linhas[0]);
    const lista = colunas.map((coluna) => `"${coluna}"`).join(",");

    for (let inicio = 0; inicio < linhas.length; inicio += LOTE) {
      const fatia = linhas.slice(inicio, inicio + LOTE);
      const valores = [];
      const marcadores = fatia
        .map((linha, indiceLinha) => {
          const posicoes = colunas.map((coluna, indiceColuna) => {
            valores.push(linha[coluna]);
            return `$${indiceLinha * colunas.length + indiceColuna + 1}`;
          });
          return `(${posicoes.join(",")})`;
        })
        .join(",");
      await alvo.query(
        `INSERT INTO "${tabela}" (${lista}) VALUES ${marcadores} ON CONFLICT DO NOTHING`,
        valores,
      );
    }

    const conferencia = await alvo.query(`SELECT count(*)::int AS total FROM "${tabela}"`);
    const destino = Number(conferencia.rows[0].total);
    resumo.push({ tabela, origem: linhas.length, destino });
    log(`${tabela}: ${linhas.length} -> ${destino}`);
  }

  return resumo;
}

/**
 * Sequences ficam paradas depois de uma copia com id explicito: o proximo
 * INSERT tentaria reusar o id 1 e quebraria a chave primaria. Reposiciona
 * cada uma logo acima do maior valor ja gravado.
 */
export async function ajustarSequences(alvo, log = console.log) {
  const sequences = await alvo.query(
    `SELECT c.table_name, c.column_name,
            pg_get_serial_sequence(quote_ident(c.table_name), c.column_name) AS seq
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_name = c.table_name AND t.table_schema = c.table_schema
      WHERE c.table_schema='public' AND t.table_type='BASE TABLE'
        AND pg_get_serial_sequence(quote_ident(c.table_name), c.column_name) IS NOT NULL`,
  );

  let ajustadas = 0;
  for (const { table_name: tabela, column_name: coluna, seq } of sequences.rows) {
    const maior = await alvo.query(
      `SELECT COALESCE(MAX("${coluna}"), 0)::bigint AS maior FROM "${tabela}"`,
    );
    await alvo.query(`SELECT setval($1, $2, true)`, [
      seq,
      String(Number(maior.rows[0].maior) || 1),
    ]);
    ajustadas += 1;
  }
  if (ajustadas) log(`${ajustadas} sequence(s) reposicionada(s).`);
  return ajustadas;
}
