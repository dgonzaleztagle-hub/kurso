export interface BankOption {
  id: string;
  name: string;
  aliases?: string[];
}

// Shared transfer catalog for Chilean bank/account selection.
export const CHILEAN_BANK_OPTIONS: BankOption[] = [
  { id: "banco-bice", name: "Banco BICE" },
  { id: "banco-consorcio", name: "Banco Consorcio" },
  { id: "banco-de-chile", name: "Banco de Chile", aliases: ["Chile"] },
  { id: "banco-estado", name: "BancoEstado", aliases: ["Banco Estado", "Estado"] },
  { id: "banco-falabella", name: "Banco Falabella" },
  { id: "banco-internacional", name: "Banco Internacional" },
  { id: "banco-itau", name: "Banco Itaú", aliases: ["Itaú", "Itau"] },
  { id: "banco-ripley", name: "Banco Ripley" },
  { id: "banco-santander", name: "Banco Santander", aliases: ["Santander"] },
  { id: "banco-security", name: "Banco Security", aliases: ["Security"] },
  { id: "btg-pactual", name: "BTG Pactual Chile" },
  { id: "bci", name: "BCI", aliases: ["Banco de Credito e Inversiones"] },
  { id: "coopeuch", name: "Coopeuch" },
  { id: "global66", name: "Global66" },
  { id: "jpmorgan", name: "JPMorgan Chase Bank, N.A." },
  { id: "los-heroes", name: "Caja Los Heroes", aliases: ["Los Heroes"] },
  { id: "mach", name: "MACH" },
  { id: "mercado-pago", name: "Mercado Pago" },
  { id: "prex", name: "Prex" },
  { id: "scotiabank", name: "Scotiabank Chile", aliases: ["Scotiabank"] },
  { id: "tenpo", name: "Tenpo Prepago" },
  { id: "otros", name: "Otra institucion" },
];

export const CHILEAN_ACCOUNT_TYPES = [
  "Cuenta Corriente",
  "Cuenta Vista",
  "Cuenta de Ahorro",
  "Cuenta RUT",
  "Chequera Electronica",
] as const;
