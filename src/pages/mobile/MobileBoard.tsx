import { useState, useEffect } from 'react';
import { useTenant } from "@/contexts/TenantContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Calendar } from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

interface Announcement {
    id: string;
    message: string;
    created_at: string;
    is_active: boolean;
}

export default function MobileBoard() {
    const { currentTenant } = useTenant();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (currentTenant) {
            fetchPosts();
        }
    }, [currentTenant]);

    const fetchPosts = async () => {
        try {
            const { data, error } = await supabase
                .from('dashboard_notifications')
                .select('*')
                .eq('tenant_id', currentTenant?.id)
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching posts:', error);
                setAnnouncements([]);
            } else {
                setAnnouncements((data as any) || []);
            }
        } catch (err) {
            console.error('Exception fetching posts:', err);
            setAnnouncements([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen bg-gray-50/50 dark:bg-gray-900/50">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Tablón de Anuncios
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Comunicados oficiales y novedades
                    </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Megaphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-10 text-gray-400">Cargando anuncios...</div>
                ) : announcements.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        No hay anuncios publicados.
                    </div>
                ) : (
                    announcements.map((item) => (
                        <Card
                            key={item.id}
                            className="border-none shadow-sm overflow-hidden transition-all duration-200 bg-white dark:bg-[#1c2630]"
                        >
                            <div className="p-5">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="flex gap-2">
                                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 h-6">
                                            Oficial
                                        </Badge>
                                        {new Date(item.created_at) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) && (
                                            <Badge className="bg-red-500 hover:bg-red-600 text-white h-6 animate-pulse">
                                                NUEVO
                                            </Badge>
                                        )}
                                    </div>
                                    <span className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {format(new Date(item.created_at), "d MMM", { locale: es })}
                                    </span>
                                </div>

                                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-3">
                                    {item.message}
                                </p>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
