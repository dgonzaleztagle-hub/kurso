import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PromoCodeFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

export function PromoCodeField({ value, onChange, disabled = false, className }: PromoCodeFieldProps) {
  const inputId = useId();

  return (
    <div className={className}>
      <Label htmlFor={inputId}>¿Tienes un código de descuento?</Label>
      <Input
        id={inputId}
        value={value}
        disabled={disabled}
        maxLength={32}
        placeholder="Ingresa tu código"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className="mt-2 uppercase"
        onChange={(event) => onChange(event.target.value.toUpperCase())}
      />
      <p className="mt-2 text-xs text-slate-500">
        Si el código es válido, el descuento se aplica en el checkout de Mercado Pago.
      </p>
    </div>
  );
}
