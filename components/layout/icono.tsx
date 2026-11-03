import {
  BellRing, Building2, Container, Factory, HardHat, LayoutDashboard, MapPinned, Pickaxe,
  ScrollText, Tractor, Truck, Users, Wallet, Workflow, type LucideIcon,
} from "lucide-react";

const ICONOS: Record<string, LucideIcon> = {
  BellRing, Building2, Container, Factory, HardHat, LayoutDashboard, MapPinned, Pickaxe,
  ScrollText, Tractor, Truck, Users, Wallet, Workflow,
};

export function Icono({ nombre, className }: { nombre: string; className?: string }) {
  const C = ICONOS[nombre] ?? LayoutDashboard;
  return <C className={className} aria-hidden />;
}
