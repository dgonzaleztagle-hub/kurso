import { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, ChevronDown, ChevronUp, CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Minute {
    id: number;
    title: string;
    content: string;
    meeting_date: string;
    status: string;
}

export default function MobileActas() {
    const { currentTenant } = useTenant();
    const [minutes, setMinutes] = useState<Minute[]>([]);
    const [loading, setLoading] = useState(true);
    const [openItems, setOpenItems] = useState<number[]>([]);

    useEffect(() => {
        if (currentTenant) {
            fetchMinutes();
        }
    }, [currentTenant]);

    const fetchMinutes = async () => {
        try {
            const { data, error } = await supabase
                .from("meeting_minutes")
                .select("*")
                .eq("tenant_id", currentTenant?.id)
                .eq("status", "published") // Only published minutes
                .order("meeting_date", { ascending: false });

            if (error) throw error;
            setMinutes(data || []);
        } catch (err) {
            console.error("Error fetching minutes:", err);
        } finally {
            setLoading(false);
        }
    };

    const toggleItem = (id: number) => {
        if (openItems.includes(id)) {
            setOpenItems(openItems.filter(i => i !== id));
        } else {
            setOpenItems([...openItems, id]);
        }
    };

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
    }

    return (
        <div className="flex flex-col gap-4 p-4 min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between pb-2">
                <h1 className="text-2xl font-bold text-[#111418] dark:text-white">Actas</h1>
                <span className="text-xs text-gray-500 font-medium">{currentTenant?.name}</span>
            </div>

            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Historial de Reuniones</p>

            {minutes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <FileText className="w-12 h-12 mb-2 opacity-20" />
                    <p>No hay actas publicadas</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {minutes.map((minute) => {
                        const isOpen = openItems.includes(minute.id);
                        return (
                            <Card key={minute.id} className="border-none shadow-sm overflow-hidden transition-all duration-200 bg-white dark:bg-[#1c2630]">
                                <div
                                    onClick={() => toggleItem(minute.id)}
                                    className="p-4 flex items-start gap-3 cursor-pointer active:bg-gray-50 dark:active:bg-gray-800"
                                >
                                    {/* Icon Box */}
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isOpen ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                        <FileText className="w-5 h-5" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h3 className={`font-bold text-sm leading-tight ${isOpen ? 'text-blue-600' : 'text-[#111418] dark:text-gray-200'}`}>
                                                {minute.title}
                                            </h3>
                                            {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal bg-gray-100 text-gray-500">
                                                <CalendarDays className="w-3 h-3 mr-1" />
                                                {format(parseISO(minute.meeting_date), "d MMM yyyy", { locale: es })}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                {/* Content (Collapsible) */}
                                <div className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${isOpen ? 'max-h-[500px]' : 'max-h-0'}`}>
                                    <div className="p-4 pt-0 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap border-t border-gray-100 dark:border-gray-800 mt-2">
                                        {minute.content}
                                    </div>
                                    <div className="p-2 bg-gray-50 dark:bg-gray-800/50 text-center">
                                        <button className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                                            Descargar PDF (Próximamente)
                                        </button>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
