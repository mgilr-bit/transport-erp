import { requireSession } from "@/lib/auth";
import { filtroAlertas } from "@/lib/alertas";
import { prisma } from "@/lib/db";
import { navegacionPara } from "@/lib/navegacion";
import { MobileNav, Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const alertas = await prisma.alerta.count({ where: { leida: false, ...filtroAlertas(session) } });
  const secciones = navegacionPara(session);

  return (
    <div className="min-h-screen">
      <Sidebar secciones={secciones} alertas={alertas} />
      <div className="lg:pl-64 print:pl-0">
        <Topbar session={session} alertas={alertas} />
        <MobileNav secciones={secciones} />
        <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}
