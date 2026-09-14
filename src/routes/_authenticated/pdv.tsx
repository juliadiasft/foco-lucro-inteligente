import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Minus, Plus, Receipt, Search, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listProducts, type Product } from "@/lib/api/products.functions";
import { createSale } from "@/lib/api/sales.functions";
import { brl, num } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pdv")({
  head: () => ({ meta: [{ title: "Registrar venda — Central do Comerciante" }] }),
  component: PdvPage,
});

type Payment = "cash" | "pix" | "debit" | "credit" | "boleto" | "other";
type CartItem = { product: Product; quantity: number };
const payments: { value: Payment; label: string }[] = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "debit", label: "Débito" },
  { value: "credit", label: "Crédito" },
  { value: "boleto", label: "Boleto" },
  { value: "other", label: "Outro" },
];

// Registrar venda no celular.
//
// Antes o carrinho ficava embaixo de uma grade de produtos com 65% da altura da
// tela: no celular a pessoa tocava nos produtos e não via o que tinha entrado,
// nem o total, nem o botão de finalizar — tinha de rolar por toda a grade. A
// busca abria o teclado sozinha ao entrar, cobrindo metade da tela antes de
// qualquer toque. Os botões de − e + do carrinho tinham 28px.
//
// Agora a lista de produtos ocupa a tela, e o total fica numa barra fixa
// embaixo; tocar nela abre a venda. No computador, o carrinho continua ao lado.
function PdvPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState("");
  const [discount, setDiscount] = useState("");
  const [payment, setPayment] = useState<Payment>("cash");
  const [folha, setFolha] = useState(false);
  const busca = useRef<HTMLInputElement>(null);

  // No computador, digitar logo ao abrir é o que se quer no balcão. No
  // celular, o teclado subindo sozinho esconde a tela: lá o foco espera o toque.
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) busca.current?.focus();
  }, []);

  const { data: products = [] } = useQuery({
    queryKey: ["products-pdv"],
    queryFn: () => listProducts(),
  });
  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return products
      .filter(
        (p) =>
          !term ||
          p.name.toLowerCase().includes(term) ||
          (p.sku || "").toLowerCase().includes(term),
      )
      .slice(0, 60);
  }, [products, search]);

  const quantidadeNoCarrinho = (id: string) =>
    cart.find((item) => item.product.id === id)?.quantity ?? 0;

  const add = (product: Product) => {
    if (product.stock <= 0) return toast.error("Produto sem estoque");
    setCart((current) => {
      const found = current.find((item) => item.product.id === product.id);
      if (found && found.quantity >= product.stock) {
        toast.error(`Só há ${num(product.stock)} ${product.unit} em estoque`);
        return current;
      }
      return found
        ? current.map((item) =>
            item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
          )
        : [...current, { product, quantity: 1 }];
    });
  };
  const change = (id: string, delta: number) =>
    setCart((current) =>
      current.flatMap((item) => {
        if (item.product.id !== id) return [item];
        const quantity = item.quantity + delta;
        if (quantity <= 0) return [];
        if (quantity > item.product.stock) {
          toast.error(`Só há ${num(item.product.stock)} ${item.product.unit} em estoque`);
          return [item];
        }
        return [{ ...item, quantity }];
      }),
    );

  const itens = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.product.salePrice * item.quantity, 0);
  const totalCost = cart.reduce((sum, item) => sum + item.product.costPrice * item.quantity, 0);
  const discountNumber = Math.max(0, Number(discount.replace(",", ".")) || 0);
  const total = Math.max(0, subtotal - discountNumber);

  const finish = useMutation({
    mutationFn: () =>
      createSale({
        data: {
          customerName: customer,
          paymentMethod: payment,
          discount: discountNumber,
          items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
        },
      }),
    onSuccess: async () => {
      toast.success(`Venda de ${brl(total)} registrada`);
      setCart([]);
      setCustomer("");
      setDiscount("");
      setFolha(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products-pdv"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["sales"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const venda = (
    <Venda
      cart={cart}
      change={change}
      customer={customer}
      setCustomer={setCustomer}
      discount={discount}
      setDiscount={setDiscount}
      payment={payment}
      setPayment={setPayment}
      subtotal={subtotal}
      total={total}
      lucro={total - totalCost}
      descontoMaiorQueSubtotal={discountNumber > subtotal}
      finalizando={finish.isPending}
      finalizar={() => finish.mutate()}
    />
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold md:text-3xl">Registrar venda</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Estoque e lucro atualizados na hora. Controle interno: não emite nota fiscal.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={busca}
              aria-label="Buscar produto"
              className="h-11 pl-9"
              placeholder="Buscar produto ou código"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {!products.length ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              Cadastre produtos em Produtos para começar a vender.
            </Card>
          ) : (
            // Lista, e não grade: no celular a grade de duas colunas cortava o
            // nome do produto em duas linhas e o preço sumia no meio.
            <ul className="divide-y divide-border border-y border-border">
              {filtered.map((p) => {
                const noCarrinho = quantidadeNoCarrinho(p.id);
                const semEstoque = p.stock <= 0;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={semEstoque}
                      onClick={() => add(p)}
                      className={cn(
                        "flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-50",
                        noCarrinho > 0 && "bg-primary/5",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {semEstoque ? "Sem estoque" : `${num(p.stock)} ${p.unit} em estoque`}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {brl(p.salePrice)}
                      </span>
                      <span
                        className={cn(
                          "flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full px-2 text-sm font-semibold tabular-nums",
                          noCarrinho > 0
                            ? "bg-primary text-primary-foreground"
                            : "border border-border text-muted-foreground",
                        )}
                      >
                        {noCarrinho > 0 ? noCarrinho : <Plus className="h-4 w-4" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {/* Espaço para a barra do total não cobrir o último produto. */}
          {cart.length > 0 && <div className="h-16 lg:hidden" />}
        </div>

        <Card className="hidden h-fit p-4 lg:sticky lg:top-4 lg:block">{venda}</Card>
      </div>

      {/* A barra do total, só no celular, presa acima da navegação. */}
      {cart.length > 0 && (
        <button
          type="button"
          onClick={() => setFolha(true)}
          className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-elegant lg:hidden"
        >
          <ShoppingCart className="h-5 w-5 shrink-0" />
          <span className="text-sm">
            {num(itens)} {itens === 1 ? "item" : "itens"}
          </span>
          <span className="ml-auto text-lg font-bold tabular-nums">{brl(total)}</span>
          <span className="text-sm font-semibold">Ver venda</span>
        </button>
      )}

      <Drawer open={folha} onOpenChange={(estado) => !estado && setFolha(false)}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Venda</DrawerTitle>
            <DrawerDescription>
              {num(itens)} {itens === 1 ? "item" : "itens"}
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">{venda}</div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function Venda({
  cart,
  change,
  customer,
  setCustomer,
  discount,
  setDiscount,
  payment,
  setPayment,
  subtotal,
  total,
  lucro,
  descontoMaiorQueSubtotal,
  finalizando,
  finalizar,
}: {
  cart: CartItem[];
  change: (id: string, delta: number) => void;
  customer: string;
  setCustomer: (valor: string) => void;
  discount: string;
  setDiscount: (valor: string) => void;
  payment: Payment;
  setPayment: (valor: Payment) => void;
  subtotal: number;
  total: number;
  lucro: number;
  descontoMaiorQueSubtotal: boolean;
  finalizando: boolean;
  finalizar: () => void;
}) {
  if (!cart.length)
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        <ShoppingCart className="mx-auto mb-2 h-6 w-6" />
        Toque nos produtos para montar a venda.
      </div>
    );

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border">
        {cart.map((item) => (
          <li key={item.product.id} className="flex items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.product.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {brl(item.product.salePrice)} · {brl(item.product.salePrice * item.quantity)}
              </p>
            </div>
            <Button
              size="icon"
              variant="outline"
              className="h-10 w-10 shrink-0 rounded-full"
              aria-label={`Tirar um ${item.product.name}`}
              onClick={() => change(item.product.id, -1)}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-8 text-center font-semibold tabular-nums">{item.quantity}</span>
            <Button
              size="icon"
              variant="outline"
              className="h-10 w-10 shrink-0 rounded-full"
              aria-label={`Mais um ${item.product.name}`}
              onClick={() => change(item.product.id, 1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>

      <div>
        <Label>Pagamento</Label>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {payments.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={payment === item.value}
              onClick={() => setPayment(item.value)}
              className={cn(
                "h-10 rounded-lg border text-sm font-medium transition-colors",
                payment === item.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="desconto">Desconto (R$)</Label>
          <Input
            id="desconto"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0,00"
            className="h-11 tabular-nums"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cliente">Cliente (opcional)</Label>
          <Input
            id="cliente"
            className="h-11"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1 border-t border-border pt-3 text-sm tabular-nums">
        {subtotal !== total && (
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{brl(subtotal)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <span className="font-medium">Total</span>
          <span className="text-2xl font-bold">{brl(total)}</span>
        </div>
        <div
          className={cn(
            "flex justify-between text-xs",
            lucro >= 0 ? "text-success" : "text-destructive",
          )}
        >
          <span>Sobra desta venda</span>
          <span>{brl(lucro)}</span>
        </div>
        {descontoMaiorQueSubtotal && (
          <p className="text-xs font-medium text-destructive">
            O desconto é maior que o valor dos produtos.
          </p>
        )}
      </div>

      <Button
        className="w-full"
        size="lg"
        disabled={finalizando || descontoMaiorQueSubtotal}
        onClick={finalizar}
      >
        <Receipt className="mr-2 h-4 w-4" />
        {finalizando ? "Registrando..." : `Finalizar venda de ${brl(total)}`}
      </Button>
    </div>
  );
}
