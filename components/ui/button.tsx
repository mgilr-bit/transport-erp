import { cn } from "@/lib/utils";

const variantes = {
  primario: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  secundario: "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
  peligro: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  fantasma: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
} as const;

const tamanos = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
} as const;

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: keyof typeof variantes;
  tamano?: keyof typeof tamanos;
};

export function buttonClass(variante: keyof typeof variantes = "primario", tamano: keyof typeof tamanos = "md") {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors cursor-pointer",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:pointer-events-none disabled:opacity-50",
    variantes[variante],
    tamanos[tamano],
  );
}

export function Button({ variante, tamano, className, ...props }: ButtonProps) {
  return <button className={cn(buttonClass(variante, tamano), className)} {...props} />;
}
