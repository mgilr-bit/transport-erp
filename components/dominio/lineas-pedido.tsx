"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input, Select } from "@/components/ui/form";
import { formatQ } from "@/lib/utils";

export type ProductoPedido = { id: number; nombre: string; unidad: string; precio: number };

/** Filas de producto y cantidad de un pedido. Envía los campos `productoId` y `cantidad` repetidos. */
export function LineasPedido({ productos, inicial }: { productos: ProductoPedido[]; inicial?: number }) {
  const [lineas, setLineas] = useState([{ clave: 0, productoId: inicial ?? 0, cantidad: "" }]);
  const producto = (id: number) => productos.find((p) => p.id === id);
  const total = lineas.reduce((s, l) => s + (producto(l.productoId)?.precio ?? 0) * (Number(l.cantidad) || 0), 0);
  const cambiar = (clave: number, cambio: Partial<{ productoId: number; cantidad: string }>) =>
    setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, ...cambio } : l)));

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">Productos</p>
      {lineas.map((l) => {
        const p = producto(l.productoId);
        return (
          <div key={l.clave} className="grid grid-cols-[1fr_7rem_2rem] items-center gap-2 sm:grid-cols-[1fr_8rem_7rem_2rem]">
            <Select name="productoId" value={l.productoId || ""} onChange={(e) => cambiar(l.clave, { productoId: Number(e.target.value) })} aria-label="Producto">
              <option value="" disabled>Seleccione un producto…</option>
              {productos.map((o) => <option key={o.id} value={o.id}>{o.nombre} · {formatQ(o.precio)} / {o.unidad}</option>)}
            </Select>
            <Input name="cantidad" type="number" min="0.01" step="0.01" value={l.cantidad} onChange={(e) => cambiar(l.clave, { cantidad: e.target.value })} placeholder={p?.unidad ?? "Cantidad"} aria-label="Cantidad" />
            <span className="hidden text-right text-sm text-slate-600 tabular sm:block">{formatQ((p?.precio ?? 0) * (Number(l.cantidad) || 0))}</span>
            <button
              type="button"
              onClick={() => setLineas((ls) => ls.filter((x) => x.clave !== l.clave))}
              disabled={lineas.length === 1}
              className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-30"
              aria-label="Quitar producto"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        );
      })}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setLineas((ls) => [...ls, { clave: Math.max(...ls.map((x) => x.clave)) + 1, productoId: 0, cantidad: "" }])}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
        >
          <Plus className="size-4" /> Agregar producto
        </button>
        <p className="text-sm text-slate-600">Total estimado <span className="font-semibold text-slate-900 tabular">{formatQ(total)}</span></p>
      </div>
    </div>
  );
}
