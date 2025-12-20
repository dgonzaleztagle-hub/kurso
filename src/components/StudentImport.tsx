import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { Download, Upload, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { validateRut, formatRut, cleanRutForDB } from "@/lib/rutUtils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface StudentImportProps {
    onSuccess: () => void;
    tenantId?: string;
}

interface ImportedStudent {
    name: string;
    rut: string;
    isValidRut: boolean;
    status?: 'pending' | 'success' | 'error';
    errorMessage?: string;
}

export function StudentImport({ onSuccess, tenantId }: StudentImportProps) {
    const [importing, setImporting] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [data, setData] = useState<ImportedStudent[]>([]);
    const { toast } = useToast();

    // ... (rest of code)

    // In handleImport loop:
    /* 
       Optimization: I will just replace the handleImport block or the whole file segment 
       Wait, I need to match context.
       I'll use MultiReplace if possible? Or just replace the Insert.
       But I need to destructure `tenantId` from props.
       So I must change the function signature line.
    */
    /* Retrying with exact context. */


    const handleDownloadTemplate = () => {
        const ws = XLSX.utils.json_to_sheet([
            { Nombre: "Juan Pérez", RUT: "12345678-9" },
            { Nombre: "María González", RUT: "98765432-1" },
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
        XLSX.writeFile(wb, "plantilla_alumnos.xlsx");
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setAnalyzing(true);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const rawData = XLSX.utils.sheet_to_json(ws);

                const processed: ImportedStudent[] = rawData.map((row: any) => {
                    // Intentar mapear columnas flexibles (Nombre, Nombres, Name / RUT, Rut, Id)
                    const name = row['Nombre'] || row['Nombres'] || row['Name'] || '';
                    const rawRut = row['RUT'] || row['Rut'] || row['rut'] || '';

                    return {
                        name: String(name).trim(),
                        rut: String(rawRut).trim(),
                        isValidRut: validateRut(String(rawRut)),
                        status: 'pending'
                    };
                }).filter(item => item.name); // Filtrar filas vacías de nombre

                setData(processed);
                if (processed.length === 0) {
                    toast({
                        title: "Archivo vacío o formato incorrecto",
                        description: "No se encontraron alumnos. Revise que las columnas sean 'Nombre' y 'RUT'.",
                        variant: "destructive"
                    });
                }
            } catch (error) {
                console.error("Error parsing Excel:", error);
                toast({
                    title: "Error al leer archivo",
                    description: "Asegúrese de que sea un Excel válido.",
                    variant: "destructive"
                });
            } finally {
                setAnalyzing(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleImport = async () => {
        if (data.length === 0) return;
        setImporting(true);

        let successCount = 0;
        let errorCount = 0;
        const newData = [...data];

        // Procesar uno a uno para manejar errores individuales
        for (let i = 0; i < newData.length; i++) {
            const student = newData[i];

            // Si el RUT es inválido, marcamos error pero intentamos guardar?
            // Política: Solo aceptamos RUTs válidos para evitar problemas de cuenta.
            if (!student.isValidRut && student.rut) {
                newData[i] = { ...student, status: 'error', errorMessage: 'RUT inválido' };
                errorCount++;
                continue;
            }

            try {
                // DB Insert
                // Split name into first and last (heuristic)
                const parts = student.name.trim().split(/\s+/);
                const firstName = parts[0] || '-';
                const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '-';

                if (!tenantId) {
                    newData[i] = { ...student, status: 'error', errorMessage: 'Error Interno: Tenant ID no disponible' };
                    errorCount++;
                    continue;
                }

                const { error } = await supabase.from('students').insert({
                    tenant_id: tenantId,
                    first_name: firstName,
                    last_name: lastName,
                    // If DB has 'name' column as well (legacy), we might need to handle it, but 'first_name/last_name' seems to be the source of truth based on Students.tsx
                    rut: student.rut ? cleanRutForDB(student.rut) : null,
                    enrollment_date: new Date().toISOString().split('T')[0] // Default inicio
                } as any);

                if (error) {
                    newData[i] = { ...student, status: 'error', errorMessage: error.message };
                    errorCount++;
                } else {
                    newData[i] = { ...student, status: 'success' };
                    successCount++;
                }
            } catch (err: any) {
                newData[i] = { ...student, status: 'error', errorMessage: err.message };
                errorCount++;
            }
        }

        setData(newData);
        setImporting(false);

        // Si hubo éxitos, refrescar lista padre
        if (successCount > 0) {
            onSuccess();
            toast({
                title: "Proceso completado",
                description: `Se importaron ${successCount} alumnos correctamente. ${errorCount} errores.`,
                variant: errorCount > 0 ? "default" : "default" // shadcn default is success-ish usually, "destructive" for error
            });
        }
    };

    const validCount = data.filter(d => d.isValidRut).length;
    const invalidCount = data.filter(d => d.rut && !d.isValidRut).length;

    return (
        <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Importación Masiva</h3>
                    <p className="text-sm text-gray-500">Carga alumnos desde Excel (Nombre, RUT).</p>
                </div>
                <Button variant="outline" onClick={handleDownloadTemplate} size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Descargar Plantilla
                </Button>
            </div>

            <div className="flex items-center gap-4">
                <Input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileUpload}
                    disabled={analyzing || importing}
                    className="bg-white"
                />
            </div>

            {data.length > 0 && (
                <div className="space-y-4">
                    <div className="flex gap-4 text-sm">
                        <span className="text-green-600 flex items-center"><CheckCircle className="w-4 h-4 mr-1" /> {validCount} RUTs válidos</span>
                        {invalidCount > 0 && (
                            <span className="text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" /> {invalidCount} RUTs inválidos</span>
                        )}
                    </div>

                    <div className="max-h-60 overflow-y-auto border rounded bg-white p-2 text-sm">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b">
                                    <th className="p-2">Nombre</th>
                                    <th className="p-2">RUT Detectado</th>
                                    <th className="p-2">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((row, idx) => (
                                    <tr key={idx} className={`border-b last:border-0 ${row.status === 'error' ? 'bg-red-50' : row.status === 'success' ? 'bg-green-50' : ''}`}>
                                        <td className="p-2">{row.name}</td>
                                        <td className={`p-2 ${!row.isValidRut && row.rut ? 'text-red-500 font-bold' : ''}`}>
                                            {row.rut || <span className="text-gray-400 italic">Sin RUT</span>}
                                        </td>
                                        <td className="p-2">
                                            {row.status === 'pending' && <span className="text-gray-500">Pendiente</span>}
                                            {row.status === 'success' && <span className="text-green-600 font-medium">Importado</span>}
                                            {row.status === 'error' && <span className="text-red-600 truncate max-w-[200px]" title={row.errorMessage}>{row.errorMessage || 'Error'}</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <Button onClick={handleImport} disabled={importing || data.every(d => d.status === 'success')}>
                        {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        {importing ? 'Importando...' : `Importar ${data.length} Alumnos`}
                    </Button>
                </div>
            )}
        </div>
    );
}
