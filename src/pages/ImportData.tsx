import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { excelPayments, excelExpenses } from "@/utils/excelData";

export default function ImportData() {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");

  const importData = async () => {
    setImporting(true);
    setProgress("Iniciando importación...");

    try {
      setProgress("Verificando folios existentes en pagos...");
      const { data: existingPayments } = await supabase.from("payments").select("folio");
      const existingFolios = new Set(existingPayments?.map((p) => p.folio) || []);
      const newPayments = excelPayments.filter((p) => !existingFolios.has(p.folio));

      if (newPayments.length > 0) {
        setProgress(`Insertando ${newPayments.length} pagos nuevos...`);
        for (let i = 0; i < newPayments.length; i += 100) {
          const batch = newPayments.slice(i, i + 100);
          const { error } = await supabase.from("payments").insert(batch);
          if (error) throw error;
          setProgress(`Insertados ${Math.min(i + 100, newPayments.length)} de ${newPayments.length} pagos...`);
        }
      }

      setProgress("Verificando folios existentes en egresos...");
      const { data: existingExpenses } = await supabase.from("expenses").select("folio");
      const existingExpenseFolios = new Set(existingExpenses?.map((e) => e.folio) || []);
      const newExpenses = excelExpenses.filter((e) => !existingExpenseFolios.has(e.folio));

      if (newExpenses.length > 0) {
        setProgress(`Insertando ${newExpenses.length} egresos nuevos...`);
        for (let i = 0; i < newExpenses.length; i += 100) {
          const batch = newExpenses.slice(i, i + 100);
          const { error } = await supabase.from("expenses").insert(batch);
          if (error) throw error;
          setProgress(`Insertados ${Math.min(i + 100, newExpenses.length)} de ${newExpenses.length} egresos...`);
        }
      }

      setProgress("Importación completada exitosamente");
      toast.success(`Importación completada: ${newPayments.length} pagos y ${newExpenses.length} egresos nuevos`);
    } catch (error) {
      console.error("Error durante la importación:", error);
      toast.error("Error durante la importación de datos");
      setProgress("Error en la importación");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importar Datos</h1>
        <p className="text-muted-foreground">
          Importa datos desde el archivo Excel de ingresos y egresos
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importación de Datos Excel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">Esta herramienta importará:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Todos los registros de pagos (ingresos) del Excel</li>
              <li>Todos los registros de egresos del Excel</li>
              <li>Solo se insertarán registros nuevos (sin duplicar)</li>
            </ul>
          </div>

          {progress && (
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm font-medium">{progress}</p>
            </div>
          )}

          <Button
            onClick={importData}
            disabled={importing}
            className="w-full"
            size="lg"
          >
            {importing ? "Importando..." : "Iniciar Importación"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
