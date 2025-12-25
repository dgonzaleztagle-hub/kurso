import { useState, useEffect } from 'react';
import { useTenant } from "@/contexts/TenantContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pin, Megaphone, Calendar } from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/components/ui/use-toast";

interface Post {
    id: string;
    title: string;
    content: string;
    is_pinned: boolean;
    is_official: boolean;
    created_at: string;
    image_url?: string;
    author_id?: string;
}

export default function MobileBoard() {
    const { currentTenant } = useTenant();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        if (currentTenant) {
            fetchPosts();
        }
    }, [currentTenant]);

    const fetchPosts = async () => {
        try {
            // Fetch posts for the current tenant
            // Note: If the table doesn't exist yet (migration pending), this will fail gracefully.
            const { data, error } = await supabase
                .from('posts' as any) // Casting to any until types are generated
                .select('*')
                .eq('tenant_id', currentTenant?.id)
                .eq('status', 'published')
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching posts:', error);
                // Fallback to mock data if table doesn't exist or error
                setPosts(MOCK_POSTS);
            } else {
                setPosts((data as any) || []);
            }
        } catch (err) {
            console.error('Exception fetching posts:', err);
            setPosts(MOCK_POSTS);
        } finally {
            setLoading(false);
        }
    };

    const MOCK_POSTS: Post[] = [
        {
            id: '1',
            title: '¡Bienvenidos al Año Escolar 2026!',
            content: 'Estamos muy emocionados de comenzar este nuevo ciclo. Recuerden revisar la agenda para los próximos eventos.',
            is_pinned: true,
            is_official: true,
            created_at: new Date().toISOString(),
        },
        {
            id: '2',
            title: 'Cambio de horario Reunión',
            content: 'La reunión de apoderados se ha movido para las 19:30 hrs. Favor tomar nota.',
            is_pinned: false,
            is_official: true,
            created_at: new Date(Date.now() - 86400000).toISOString(),
        }
    ];

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
                ) : posts.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        No hay anuncios publicados.
                    </div>
                ) : (
                    posts.map((post) => (
                        <Card
                            key={post.id}
                            className={`border-none shadow-sm overflow-hidden transition-all duration-200 
                ${post.is_pinned
                                    ? 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border-l-4 border-l-amber-400'
                                    : 'bg-white dark:bg-[#1c2630]'
                                }`}
                        >
                            <div className="p-5">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="flex gap-2">
                                        {post.is_pinned && (
                                            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/50 dark:text-amber-400 dark:border-amber-800 px-2 py-0.5 h-6 gap-1">
                                                <Pin className="h-3 w-3" /> Fijado
                                            </Badge>
                                        )}
                                        {post.is_official && !post.is_pinned && (
                                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 h-6">
                                                Oficial
                                            </Badge>
                                        )}
                                        {/* Logic for NEW badge ( < 3 days ) */}
                                        {new Date(post.created_at) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) && (
                                            <Badge className="bg-red-500 hover:bg-red-600 text-white h-6 animate-pulse">
                                                NUEVO
                                            </Badge>
                                        )}
                                    </div>
                                    <span className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {format(new Date(post.created_at), "d MMM", { locale: es })}
                                    </span>
                                </div>

                                <h3 className={`font-semibold text-lg mb-2 leading-tight ${post.is_pinned ? 'text-gray-900 dark:text-gray-100' : 'text-gray-800 dark:text-gray-200'}`}>
                                    {post.title}
                                </h3>

                                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-3">
                                    {post.content}
                                </p>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
