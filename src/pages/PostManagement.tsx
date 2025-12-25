import { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus, Trash2, Pin, Globe, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Post {
    id: string;
    title: string;
    content: string;
    is_official: boolean;
    is_pinned: boolean;
    status: 'published' | 'draft' | 'archived';
    created_at: string;
}

const PostManagement = () => {
    const { currentTenant } = useTenant();
    const { toast } = useToast();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [isOfficial, setIsOfficial] = useState(true);
    const [isPinned, setIsPinned] = useState(false);

    useEffect(() => {
        if (currentTenant) {
            fetchPosts();
        }
    }, [currentTenant]);

    const fetchPosts = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('posts' as any)
                .select('*')
                .eq('tenant_id', currentTenant?.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPosts((data as any) || []);
        } catch (error) {
            console.error('Error fetching posts:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudieron cargar los anuncios.'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentTenant) return;

        try {
            setIsSubmitting(true);
            const { error } = await supabase.from('posts' as any).insert({
                tenant_id: currentTenant.id,
                title,
                content,
                is_official: isOfficial,
                is_pinned: isPinned,
                status: 'published'
            });

            if (error) throw error;

            toast({
                title: 'Éxito',
                description: 'Anuncio publicado correctamente.'
            });

            setIsDialogOpen(false);
            resetForm();
            fetchPosts();
        } catch (error) {
            console.error('Error creating post:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudo crear el anuncio.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeletePost = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este anuncio?')) return;

        try {
            const { error } = await supabase
                .from('posts' as any)
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast({
                title: 'Eliminado',
                description: 'El anuncio ha sido eliminado.'
            });
            fetchPosts();
        } catch (error) {
            console.error('Error deleting post:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudo eliminar el anuncio.'
            });
        }
    };

    const resetForm = () => {
        setTitle("");
        setContent("");
        setIsOfficial(true);
        setIsPinned(false);
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Anuncios y Comunicados</h1>
                    <p className="text-muted-foreground">Gestiona las noticias que verán los apoderados en la app móvil.</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Nuevo Anuncio
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Crear Nuevo Anuncio</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreatePost} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Título</Label>
                                <Input
                                    id="title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej: Reunión de Apoderados"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="content">Contenido</Label>
                                <Textarea
                                    id="content"
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="Escribe el detalle del comunicado..."
                                    className="min-h-[100px]"
                                    required
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="official" className="flex flex-col gap-1">
                                    <span>Marcar como Oficial</span>
                                    <span className="text-xs text-muted-foreground">Aparece con una insignia azul.</span>
                                </Label>
                                <Switch
                                    id="official"
                                    checked={isOfficial}
                                    onCheckedChange={setIsOfficial}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="pinned" className="flex flex-col gap-1">
                                    <span>Fijar al Inicio</span>
                                    <span className="text-xs text-muted-foreground">Aparecerá siempre primero en la lista.</span>
                                </Label>
                                <Switch
                                    id="pinned"
                                    checked={isPinned}
                                    onCheckedChange={setIsPinned}
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Publicar
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4">
                {posts.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                            <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                            <p>No hay anuncios publicados aún.</p>
                        </CardContent>
                    </Card>
                ) : (
                    posts.map((post) => (
                        <Card key={post.id} className="overflow-hidden">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="space-y-2 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {post.is_pinned && (
                                                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                                    <Pin className="mr-1 h-3 w-3" />
                                                    Fijado
                                                </span>
                                            )}
                                            {post.is_official && (
                                                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                    <Globe className="mr-1 h-3 w-3" />
                                                    Oficial
                                                </span>
                                            )}
                                            <span className="text-sm text-muted-foreground">
                                                {format(new Date(post.created_at), "d 'de' MMMM, yyyy • HH:mm", { locale: es })}
                                            </span>
                                        </div>
                                        <h3 className="font-semibold text-xl">{post.title}</h3>
                                        <p className="text-muted-foreground whitespace-pre-wrap">{post.content}</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        onClick={() => handleDeletePost(post.id)}
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};

export default PostManagement;
