import { requireSession, filtroGiro } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { navegacionPara } from "@/lib/navegacion";
import { MobileNav, Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const alertas = await prisma.alerta.count({ where: { leida: false, ...filtroGiro(session) } });
  const secciones = navegacionPara(session);

  return (
    <div className="min-h-screen">
      <Sidebar secciones={secciones} alertas={alertas} />
      <div className="lg:pl-64">
        <Topbar session={session} alertas={alertas} />
        <MobileNav secciones={secciones} />
        <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
