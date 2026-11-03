export function PageHeader({
  titulo,
  descripcion,
  acciones,
  etiqueta,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: React.ReactNode;
  etiqueta?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {etiqueta && <div className="mb-1.5">{etiqueta}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-3xl text-sm text-slate-500">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}
