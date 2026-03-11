import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  compact?: boolean;
};

export function MercadoPagoBadge({ className, compact = false }: Props) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-sky-300/70 bg-sky-50 px-3 py-1.5 text-sky-900",
        compact && "px-2.5 py-1 text-xs",
        className,
      )}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#009EE3] text-[10px] font-black text-white">
        MP
      </span>
      <span className={cn("text-sm font-semibold tracking-tight", compact && "text-xs")}>
        Mercado Pago
      </span>
    </div>
  );
}
