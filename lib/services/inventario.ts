import "server-only";
import { crearAlerta } from "@/lib/services/alertas";
import { Prisma } from "@/app/generated/prisma/client";
import { toNumber } from "@/lib/utils";

/** Ajusta el inventario de una sede; lanza error si el saldo quedaría negativo. */
export async function ajustarInventario(tx: Prisma.TransactionClient, sedeId: number, materialId: number, delta: number) {
  const actual = await tx.inventario.findUnique({ where: { sedeId_materialId: { sedeId, materialId } }, include: { material: true, sede: true } });
  const nuevo = toNumber(actual?.cantidad) + delta;
  if (nuevo < 0) {
    throw new Error(`Inventario insuficiente de ${actual?.material.nombre ?? "material"} en ${actual?.sede.nombre ?? "la sede"}`);
  }
  const registro = await tx.inventario.upsert({
    where: { sedeId_materialId: { sedeId, materialId } },
    update: { cantidad: new Prisma.Decimal(nuevo) },
    create: { sedeId, materialId, cantidad: new Prisma.Decimal(nuevo) },
    include: { material: true, sede: true },
  });

  if (delta < 0 && nuevo < toNumber(registro.material.stockMinimo)) {
    await crearAlerta({
      tipo: "INVENTARIO_BAJO",
      severidad: "ADVERTENCIA",
      giro: registro.sede.giro,
      titulo: `${registro.sede.nombre}: inventario bajo de ${registro.material.nombre}`,
      mensaje: `Quedan ${nuevo.toFixed(2)} ${registro.material.unidad} (mínimo ${toNumber(registro.material.stockMinimo)}).`,
      referencia: `inventario:${sedeId}:${materialId}`,
    }, tx);
  }
  return registro;
}
