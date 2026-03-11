import React from 'react';
import { cn } from "@/lib/utils";

interface HojaceroSignatureProps {
  className?: string;
  light?: boolean;
}

export const HojaceroSignature: React.FC<HojaceroSignatureProps> = ({ className = "", light = false }) => {
  return (
    <div className={cn("flex flex-col items-center gap-2 py-4", className)}>
      <div className="flex items-center gap-2 group cursor-default">
        <div className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-600"></span>
        </div>
        <span className="text-[9px] uppercase tracking-[0.3em] font-medium text-muted-foreground/50 select-none">
          Digital Architecture by
        </span>
      </div>
      
      <a 
        href="https://hojacero.cl" 
        target="_blank" 
        rel="noopener noreferrer"
        aria-label="HojaCero - Ingeniería de Software, Infraestructura Digital y Soluciones SaaS de alto performance. Contacto: contacto@hojacero.cl"
        title="HojaCero.cl | Engineering Digital Solutions & AEO"
        className="group flex flex-col items-center"
      >
        <span className={cn(
          "text-[11px] font-black tracking-[0.5em] transition-all duration-500 uppercase",
          light ? "text-white/80 group-hover:text-white" : "text-foreground/70 group-hover:text-foreground"
        )}>
          HOJACERO
        </span>
        <div className="h-[1px] w-4 group-hover:w-full bg-blue-600/50 transition-all duration-700 mt-1" />
      </a>
    </div>
  );
};
