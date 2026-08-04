import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Minus, Plus, Receipt, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listProducts, type Product } from "@/lib/api/products.functions";
import { createSale } from "@/lib/api/sales.functions";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/pdv")({
  head: () => ({ meta: [{ title: "PDV — Central do Comerciante" }] }),
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

function PdvPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState("");
  const [discount, setDiscount] = useState("0");
  const [payment, setPayment] = useState<Payment>("cash");
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
      .slice(0, 30);
  }, [products, search]);
  const add = (product: Product) => {
    if (product.stock <= 0) return toast.error("Produto sem estoque");
    setCart((current) => {
      const found = current.find((item) => item.product.id === product.id);
      if (found && found.quantity >= product.stock) {
        toast.error("Quantidade máxima em estoque atingida");
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
          toast.error("Quantidade maior que o estoque");
          return [item];
        }
        return [{ ...item, quantity }];
      }),
    );
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
      setCart([]);
      setCustomer("");
      setDiscount("0");
      setPayment("cash");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products-pdv"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["sales"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      toast.success("Venda registrada com baixa no estoque!");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">PDV — Registrar venda</h1>
        <p className="text-muted-foreground">Venda, estoque e lucro atualizados ao mesmo tempo.</p>
      </div>
      <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
        <strong>Aviso:</strong> este PDV é para controle interno e não emite NF-e ou NFC-e.
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <Card className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              autoFocus
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {!products.length ? (
            <div className="p-12 text-center text-muted-foreground">
              Cadastre produtos para começar.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[65vh] overflow-y-auto">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  disabled={p.stock <= 0}
                  onClick={() => add(p)}
                  className="text-left p-3 rounded-lg border hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                >
                  <div className="font-medium text-sm line-clamp-2">{p.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">Estoque: {p.stock}</div>
                  <div className="text-primary font-bold mt-1">{brl(p.salePrice)}</div>
                </button>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-4 flex flex-col max-h-[80vh]">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Carrinho ({cart.length})</h2>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="ml-auto">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 min-h-[100px]">
            {!cart.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum item adicionado
              </p>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center gap-2 p-2 rounded-md bg-muted/40"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {brl(item.product.salePrice)}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => change(item.product.id, -1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-7 text-center text-sm">{item.quantity}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => change(item.product.id, 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() =>
                      setCart((current) =>
                        current.filter((line) => line.product.id !== item.product.id),
                      )
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
          <div className="border-t mt-3 pt-3 space-y-3">
            <Field label="Cliente (opcional)">
              <Input value={customer} onChange={(e) => setCustomer(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Desconto (R$)">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </Field>
              <Field label="Pagamento">
                <Select value={payment} onValueChange={(value) => setPayment(value as Payment)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {payments.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="space-y-1 text-sm bg-muted/50 rounded-lg p-3">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{brl(subtotal)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-1">
                <span>Total</span>
                <span className="text-primary">{brl(total)}</span>
              </div>
              <div className="flex justify-between text-xs text-success">
                <span>Lucro estimado</span>
                <span>{brl(total - totalCost)}</span>
              </div>
            </div>
            <Button
              className="w-full"
              size="lg"
              disabled={finish.isPending || !cart.length}
              onClick={() => finish.mutate()}
            >
              <Receipt className="h-4 w-4 mr-2" />
              {finish.isPending ? "Registrando..." : "Finalizar venda"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
