import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { MeetingMinute } from "@/types/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, FileIcon, Image as ImageIcon, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function MeetingMinutes() {
    const { userRole } = useAuth();
    const { currentTenant } = useTenant();
    const { toast } = useToast();

    const [minutes, setMinutes] = useState<MeetingMinute[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Form State
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [content, setContent] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const isAdmin = ['owner', 'admin', 'master'].includes(userRole || '');

    useEffect(() => {
        if (currentTenant) {
            fetchMinutes();
        }
    }, [currentTenant]);

    const fetchMinutes = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("meeting_minutes" as any)
                .select("*")
                .eq("tenant_id", currentTenant?.id) // Extra safety, though RLS handles it
                .order("meeting_date", { ascending: false });

            if (error) throw error;
            setMinutes(data as unknown as MeetingMinute[]);
        } catch (error) {
            console.error("Error fetching minutes:", error);
            toast({ title: "Error", description: "No se pudieron cargar las actas.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (file: File): Promise<string | null> => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${currentTenant?.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('meeting-attachments')
            .upload(filePath, file);

        if (uploadError) {
            throw uploadError;
        }

        const { data } = supabase.storage
            .from('meeting-attachments')
            .getPublicUrl(filePath);

        return data.publicUrl;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentTenant) return;

        setSubmitting(true);
        try {
            let imageUrl = null;
            if (file) {
                imageUrl = await handleFileUpload(file);
            }

            const { error } = await supabase
                .from("meeting_minutes" as any)
                .insert({
                    tenant_id: currentTenant.id,
                    meeting_date: date,
                    content,
                    image_url: imageUrl,
                });

            if (error) throw error;

            toast({ title: "Éxito", description: "Acta registrada correctamente." });
            setIsDialogOpen(false);
            resetForm();
            fetchMinutes();
        } catch (error: any) {
            console.error("Error saving minute:", error);
            toast({ title: "Error", description: error.message || "No se pudo guardar el acta.", variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setDate(new Date().toISOString().split('T')[0]);
        setContent("");
        setFile(null);
    };

    return (
        <div className="container mx-auto py-8 space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Actas de Reunión</h1>
                    <p className="text-muted-foreground">Historial de acuerdos y notas de reuniones del curso.</p>
                </div>

                {isAdmin && (
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <Plus className="h-4 w-4" /> Nueva Acta
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>Registrar Nueva Acta</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Fecha de Reunión</label>
                                    <Input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Contenido / Resumen</label>
                                    <Textarea
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        placeholder="Puntos tratados en la reunión..."
                                        rows={5}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Foto del Cuaderno (Opcional)</label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                                            className="cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-4">
                                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                                    <Button type="submit" disabled={submitting}>
                                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Guardar Acta
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <div className="grid gap-4">
                {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Cargando actas...</div>
                ) : minutes.length === 0 ? (
                    <Card className="border-dashed bg-muted/20">
                        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                            <FileIcon className="h-10 w-10 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium">No hay actas registradas</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Las actas de las reuniones aparecerán aquí.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    minutes.map((minute) => (
                        <Card key={minute.id} className="overflow-hidden">
                            <CardHeader className="bg-muted/30 pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-primary font-semibold">
                                        <CalendarIcon className="h-4 w-4" />
                                        {format(new Date(minute.meeting_date), "EEEE d 'de' MMMM, yyyy", { locale: es })}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 grid md:grid-cols-[1fr_200px] gap-6">
                                <div className="space-y-4">
                                    {minute.content ? (
                                        <div className="text-sm whitespace-pre-wrap leading-relaxed">
                                            {minute.content}
                                        </div>
                                    ) : (
                                        <span className="text-sm text-muted-foreground italic">Sin contenido de texto.</span>
                                    )}
                                </div>

                                {minute.image_url && (
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                            <ImageIcon className="h-3 w-3" /> Evidencia Adjunta
                                        </span>
                                        <a
                                            href={minute.image_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block group relative overflow-hidden rounded-md border aspect-video md:aspect-square bg-muted"
                                        >
                                            <img
                                                src={minute.image_url}
                                                alt="Foto del acta"
                                                className="object-cover w-full h-full transition-transform group-hover:scale-105"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <span className="text-white text-xs font-medium">Ver completa</span>
                                            </div>
                                        </a>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
