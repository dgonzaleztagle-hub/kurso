import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CHILEAN_BANK_OPTIONS } from "@/lib/banking";
import { cn } from "@/lib/utils";

interface BankComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function BankCombobox({
  value,
  onValueChange,
  placeholder = "Seleccione una institucion",
  disabled = false,
}: BankComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0" align="start">
        <Command
          filter={(candidate, search) => {
            const bank = CHILEAN_BANK_OPTIONS.find((option) => option.name === candidate);
            const searchable = [bank?.name ?? candidate, ...(bank?.aliases ?? [])]
              .join(" ")
              .toLowerCase();

            return searchable.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar banco..." />
          <CommandList>
            <CommandEmpty>No se encontro la institucion.</CommandEmpty>
            <CommandGroup>
              {CHILEAN_BANK_OPTIONS.map((bank) => (
                <CommandItem
                  key={bank.id}
                  value={bank.name}
                  onSelect={() => {
                    onValueChange(bank.name === value ? "" : bank.name);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === bank.name ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {bank.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
