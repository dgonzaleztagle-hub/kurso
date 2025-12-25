import { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Calendar, MapPin, Clock, ArrowRight } from "lucide-react";
import { format, isSameMonth, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface Activity {
    id: number;
    name: string;
    activity_date: string;
    amount: number;
    description: string;
}

const GRADIENTS = [
    "bg-gradient-to-br from-blue-500 to-indigo-600",
    "bg-gradient-to-br from-rose-500 to-pink-600",
    "bg-gradient-to-br from-emerald-500 to-teal-600",
    "bg-gradient-to-br from-violet-500 to-purple-600",
    "bg-gradient-to-br from-orange-400 to-amber-500",
];

export default function MobileAgenda() {
    const { currentTenant } = useTenant();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (currentTenant) {
            fetchActivities();
        }
    }, [currentTenant]);

    const fetchActivities = async () => {
        try {
            const { data, error } = await supabase
                .from("activities")
                .select("*")
                .eq("tenant_id", currentTenant?.id)
                .gte("activity_date", new Date().toISOString().split('T')[0]) // Only future or today
                .order("activity_date", { ascending: true });

            if (error) throw error;
            setActivities(data || []);
        } catch (err) {
            console.error("Error fetching agenda:", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
    }

    return (
        <div className="flex flex-col gap-4 p-4 min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between pb-2">
                <h1 className="text-2xl font-bold text-[#111418] dark:text-white">Agenda</h1>
                <span className="text-xs text-gray-500 font-medium">{currentTenant?.name}</span>
            </div>

            {/* Date "Tabs" (Simplified to just Next Events header for now) */}
            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Próximos Eventos</p>

            {activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <Calendar className="w-12 h-12 mb-2 opacity-20" />
                    <p>No hay eventos programados</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {activities.map((activity, index) => {
                        const date = parseISO(activity.activity_date);
                        const gradientClass = GRADIENTS[index % GRADIENTS.length];

                        return (
                            <div key={activity.id} className={`rounded-2xl p-5 text-white shadow-lg ${gradientClass} relative overflow-hidden group transition-transform active:scale-[0.98]`}>
                                {/* Decorative big number */}
                                <span className="absolute -right-4 -bottom-10 text-[120px] font-black opacity-10 select-none">
                                    {format(date, "d")}
                                </span>

                                <div className="relative z-10 flex flex-col gap-3">
                                    <div className="flex justify-between items-start">
                                        <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide w-fit">
                                            {format(date, "MMMM", { locale: es })}
                                        </div>
                                        {activity.amount > 0 && (
                                            <div className="bg-emerald-400/20 backdrop-blur-md px-2 py-1 rounded-full text-xs font-bold border border-emerald-200/30">
                                                Cuota: ${activity.amount.toLocaleString()}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <h3 className="text-2xl font-bold leading-tight">{activity.name}</h3>
                                        <p className="text-white/80 text-sm line-clamp-2 mt-1">
                                            {activity.description && !activity.description.startsWith('{')
                                                ? activity.description
                                                : "Ver detalles del evento..."}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-4 mt-2 text-sm font-medium text-white/90">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-4 h-4" />
                                            <span>{format(date, "EEEE d", { locale: es })}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-4 h-4" />
                                            <span>Todo el día</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
}
