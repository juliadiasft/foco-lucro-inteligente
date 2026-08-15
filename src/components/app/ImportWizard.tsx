import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { importOfferings, importProducts, type ImportResult } from "@/lib/api/import.functions";
import { guessColumn, parseBrazilianNumber, parseSpreadsheet, type Sheet } from "@/lib/spreadsheet";

type FieldKey =
  | "name"
  | "sku"
  | "costPrice"
  | "salePrice"
  | "stock"
  | "minimumStock"
  | "unit"
  | "brand"
  | "baseUnit"
  | "packSize"
  | "price"
  | "minimumQuantity";

type Field = {
  key: FieldKey;
  label: string;
  required: boolean;
  candidates: string[];
  help?: string;
};

const camposProdutos: Field[] = [
  {
    key: "name",
    label: "Produto",
    required: true,
    candidates: ["produto", "nome", "descricao", "item"],
  },
  {
    key: "sku",
    label: "Código / SKU",
    required: false,
    candidates: ["sku", "codigo", "referencia", "ref"],
    help: "Se informado, reimportar atualiza em vez de duplicar.",
  },
  {
    key: "costPrice",
    label: "Preço de custo",
    required: true,
    candidates: ["custo", "preco de custo", "valor de custo"],
  },
  {
    key: "salePrice",
    label: "Preço de venda",
    required: true,
    candidates: ["preco de venda", "venda", "preco"],
  },
  {
    key: "stock",
    label: "Estoque",
    required: false,
    candidates: ["estoque", "quantidade", "qtd", "saldo"],
  },
  {
    key: "minimumStock",
    label: "Estoque mínimo",
    required: false,
    candidates: ["estoque minimo", "minimo"],
  },
  { key: "unit", label: "Unidade", required: false, candidates: ["unidade", "medida", "un"] },
];

const camposCatalogo: Field[] = [
  {
    key: "name",
    label: "Produto",
    required: true,
    candidates: ["produto", "nome", "descricao", "item"],
  },
  { key: "brand", label: "Marca", required: false, candidates: ["marca", "fabricante"] },
  {
    key: "baseUnit",
    label: "Vendido por",
    required: true,
    candidates: ["unidade", "medida", "vendido por"],
    help: "Aceita kg, litro ou unidade.",
  },
  {
    key: "packSize",
    label: "Tamanho da embalagem",
    required: true,
    candidates: ["embalagem", "tamanho", "peso", "conteudo"],
    help: "Quantos kg, litros ou unidades vêm na embalagem.",
  },
  {
    key: "price",
    label: "Preço da embalagem",
    required: false,
    candidates: ["preco", "valor"],
    help: "Sem preço, o item entra como sob consulta.",
  },
  {
    key: "minimumQuantity",
    label: "Quantidade mínima",
    required: false,
    candidates: ["quantidade minima", "minimo", "pedido minimo"],
  },
];

function normalizeBaseUnit(value: string) {
  const clean = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
  if (["kg", "quilo", "quilos", "kilo", "quilograma"].includes(clean)) return "kg" as const;
  if (["l", "lt", "litro", "litros"].includes(clean)) return "l" as const;
  if (["un", "und", "unidade", "unidades", "pc", "peca", "pecas"].includes(clean))
    return "un" as const;
  return null;
}

export function ImportWizard({ mode }: { mode: "produtos" | "catalogo" }) {
  const campos = mode === "produtos" ? camposProdutos : camposCatalogo;
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, number>>>({});
  const [resultado, setResultado] = useState<ImportResult | null>(null);

  const carregar = (text: string) => {
    const parsed = parseSpreadsheet(text);
    if (!parsed.headers.length || !parsed.rows.length) {
      toast.error("Não encontrei linhas na planilha. Confira se copiou o cabeçalho junto.");
      return;
    }
    setSheet(parsed);
    setResultado(null);
    const inicial: Partial<Record<FieldKey, number>> = {};
    for (const campo of campos) {
      const index = guessColumn(parsed.headers, campo.candidates);
      if (index >= 0) inicial[campo.key] = index;
    }
    setMapping(inicial);
  };

  const importar = useMutation({
    mutationFn: async () => {
      if (!sheet) throw new Error("Nenhuma planilha carregada");
      const valor = (row: string[], key: FieldKey) => {
        const index = mapping[key];
        return index === undefined ? "" : (row[index] ?? "").trim();
      };

      const linhas: unknown[] = [];
      const problemas: string[] = [];

      sheet.rows.forEach((row, posicao) => {
        const linha = posicao + 2; // +1 do cabeçalho, +1 porque planilha começa em 1
        const name = valor(row, "name");
        if (!name) return;

        if (mode === "produtos") {
          const custo = parseBrazilianNumber(valor(row, "costPrice"));
          const venda = parseBrazilianNumber(valor(row, "salePrice"));
          if (custo === null || venda === null) {
            problemas.push(`Linha ${linha}: custo ou preço de venda inválido`);
            return;
          }
          linhas.push({
            linha,
            name,
            sku: valor(row, "sku") || undefined,
            costPrice: custo,
            salePrice: venda,
            stock: parseBrazilianNumber(valor(row, "stock")) ?? undefined,
            minimumStock: parseBrazilianNumber(valor(row, "minimumStock")) ?? undefined,
            unit: valor(row, "unit") || undefined,
          });
          return;
        }

        const baseUnit = normalizeBaseUnit(valor(row, "baseUnit"));
        const packSize = parseBrazilianNumber(valor(row, "packSize"));
        if (!baseUnit) {
          problemas.push(`Linha ${linha}: unidade não reconhecida (use kg, litro ou unidade)`);
          return;
        }
        if (packSize === null || packSize <= 0) {
          problemas.push(`Linha ${linha}: tamanho da embalagem inválido`);
          return;
        }
        linhas.push({
          linha,
          name,
          brand: valor(row, "brand") || undefined,
          baseUnit,
          packSize,
          price: parseBrazilianNumber(valor(row, "price")),
          minimumQuantity: parseBrazilianNumber(valor(row, "minimumQuantity")) ?? undefined,
        });
      });

      if (!linhas.length)
        throw new Error(problemas[0] || "Nenhuma linha válida encontrada na planilha");

      const resposta =
        mode === "produtos"
          ? await importProducts({ data: { rows: linhas as never } })
          : await importOfferings({ data: { rows: linhas as never } });

      return {
        ...resposta,
        ignorados: [...resposta.ignorados, ...problemas.map((motivo) => ({ linha: 0, motivo }))],
      };
    },
    onSuccess: (data) => {
      setResultado(data);
      toast.success(`${data.criados} criados, ${data.atualizados} atualizados`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const faltando = campos.filter((campo) => campo.required && mapping[campo.key] === undefined);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">1. Traga sua planilha</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Escolha um arquivo CSV ou copie as células direto do Excel e cole abaixo. O arquivo não
          sai do seu computador — só as linhas já lidas são enviadas.
        </p>

        <div className="mt-4 flex flex-wrap gap-3 items-center">
          <input
            id="arquivo"
            type="file"
            accept=".csv,.txt,.tsv,text/csv,text/plain"
            className="text-sm"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) carregar(await file.text());
            }}
          />
        </div>

        <div className="mt-4 space-y-1.5">
          <Label htmlFor="colar">Ou cole aqui</Label>
          <Textarea
            id="colar"
            rows={4}
            placeholder={
              mode === "produtos"
                ? "Produto;SKU;Custo;Venda;Estoque"
                : "Produto;Marca;Unidade;Embalagem;Preço"
            }
            onChange={(event) => {
              const text = event.target.value;
              if (text.trim().split("\n").length > 1) carregar(text);
            }}
          />
        </div>
      </Card>

      {sheet && (
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">2. Confira as colunas</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Encontrei {sheet.rows.length} linha(s). Ajuste qualquer coluna que eu tenha adivinhado
            errado.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {campos.map((campo) => (
              <div key={campo.key} className="space-y-1.5">
                <Label htmlFor={campo.key}>
                  {campo.label}
                  {campo.required && <span className="text-destructive"> *</span>}
                </Label>
                <select
                  id={campo.key}
                  value={mapping[campo.key] ?? ""}
                  onChange={(event) =>
                    setMapping((atual) => ({
                      ...atual,
                      [campo.key]:
                        event.target.value === "" ? undefined : Number(event.target.value),
                    }))
                  }
                  className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
                >
                  <option value="">Não usar</option>
                  {sheet.headers.map((header, index) => (
                    <option key={`${header}-${index}`} value={index}>
                      {header || `Coluna ${index + 1}`}
                    </option>
                  ))}
                </select>
                {campo.help && <p className="text-xs text-muted-foreground">{campo.help}</p>}
              </div>
            ))}
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  {sheet.headers.map((header, index) => (
                    <th key={index} className="p-2 font-medium">
                      {header || `Coluna ${index + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.rows.slice(0, 3).map((row, index) => (
                  <tr key={index} className="border-b last:border-0">
                    {sheet.headers.map((_header, coluna) => (
                      <td key={coluna} className="p-2 text-muted-foreground">
                        {row[coluna]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {faltando.length > 0 && (
            <p className="mt-4 text-sm text-destructive">
              Escolha a coluna de: {faltando.map((campo) => campo.label).join(", ")}
            </p>
          )}

          <Button
            className="mt-5"
            size="lg"
            disabled={importar.isPending || faltando.length > 0}
            onClick={() => importar.mutate()}
          >
            {importar.isPending ? "Importando..." : `Importar ${sheet.rows.length} linha(s)`}
          </Button>
        </Card>
      )}

      {resultado && (
        <Card className="p-6">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-5 w-5" />
            <h2 className="font-semibold">3. Pronto</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 mt-4">
            <div>
              <p className="text-sm text-muted-foreground">Criados</p>
              <p className="text-2xl font-bold text-success">{resultado.criados}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Atualizados</p>
              <p className="text-2xl font-bold">{resultado.atualizados}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ignorados</p>
              <p className="text-2xl font-bold text-warning">{resultado.ignorados.length}</p>
            </div>
          </div>
          {resultado.ignorados.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm text-muted-foreground max-h-48 overflow-y-auto">
              {resultado.ignorados.map((item, index) => (
                <li key={index}>
                  {item.linha ? `Linha ${item.linha}: ` : ""}
                  {item.motivo}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
