import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, User, ArrowLeft, Share2, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BLOG_POSTS } from "@/data/blogData";
import { resolveBranding } from "@/lib/branding";
import NotFound from "./NotFound";

const BlogPost = () => {
    const { slug } = useParams();
    const branding = resolveBranding();
    const post = BLOG_POSTS.find(p => p.slug === slug);

    if (!post) {
        return <NotFound />;
    }

    return (
        <div className="min-h-screen bg-background">
            <Helmet>
                <title>{post.title} | Blog Kurso</title>
                <meta name="description" content={post.excerpt} />
                <meta name="author" content={post.author} />
                <meta property="og:title" content={post.title} />
                <meta property="og:description" content={post.excerpt} />
                <meta property="og:image" content={post.image} />
                <meta property="og:type" content="article" />
                <link rel="canonical" href={`https://kurso.app/blog/${post.slug}`} />
                {/* JSON-LD Schema for Article */}
                <script type="application/ld+json">
                    {JSON.stringify({
                        "@context": "https://schema.org",
                        "@graph": [
                            {
                                "@type": "BlogPosting",
                                "headline": post.title,
                                "image": post.image,
                                "author": {
                                    "@type": "Person",
                                    "name": post.author
                                },
                                "publisher": {
                                    "@type": "Organization",
                                    "name": branding.appName,
                                    "logo": {
                                        "@type": "ImageObject",
                                        "url": branding.logoUrl
                                    }
                                },
                                "datePublished": post.date,
                                "description": post.excerpt
                            },
                            {
                                "@type": "BreadcrumbList",
                                "itemListElement": [
                                    {
                                        "@type": "ListItem",
                                        "position": 1,
                                        "name": "Inicio",
                                        "item": "https://kurso.app/"
                                    },
                                    {
                                        "@type": "ListItem",
                                        "position": 2,
                                        "name": "Blog",
                                        "item": "https://kurso.app/blog"
                                    },
                                    {
                                        "@type": "ListItem",
                                        "position": 3,
                                        "name": post.title,
                                        "item": `https://kurso.app/blog/${post.slug}`
                                    }
                                ]
                            },
                            post.slug === 'guia-tesorero-curso-chile-paso-a-paso' ? {
                                "@type": "HowTo",
                                "name": post.title,
                                "step": [
                                    {
                                        "@type": "HowToStep",
                                        "text": "Define una cuota clara y justificada."
                                    },
                                    {
                                        "@type": "HowToStep",
                                        "text": "Registra cada ingreso el mismo día que lo recibes."
                                    },
                                    {
                                        "@type": "HowToStep",
                                        "text": "No mezcles tu dinero personal con el del curso."
                                    }
                                ]
                            } : null
                        ].filter(Boolean)
                    })}
                </script>
            </Helmet>

            {/* Navbar Lite */}
            <nav className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link to="/blog" className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                        Volver al Blog
                    </Link>
                    <div className="flex items-center gap-2">
                         <Button variant="ghost" size="icon" className="rounded-full">
                            <Share2 className="h-4 w-4" />
                         </Button>
                         <Button variant="ghost" size="icon" className="rounded-full">
                            <Bookmark className="h-4 w-4" />
                         </Button>
                         <Button asChild size="sm" className="ml-2 rounded-full">
                            <Link to="/auth?mode=signup">Probar Kurso</Link>
                         </Button>
                    </div>
                </div>
            </nav>

            <article className="max-w-4xl mx-auto px-4 py-12 md:py-20">
                {/* Header */}
                <header className="space-y-6 mb-12">
                    <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest">
                        {post.category}
                    </div>
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
                        {post.title}
                    </h1>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground pt-4 border-t">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary text-xs">
                                {post.author.charAt(0)}
                            </div>
                            <span className="font-semibold text-foreground">{post.author}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(post.date), "d 'de' MMMM, yyyy", { locale: es })}
                        </div>
                    </div>
                </header>

                {/* Featured Image */}
                <div className="aspect-[21/9] rounded-2xl overflow-hidden mb-12 shadow-2xl">
                    <img 
                        src={post.image} 
                        alt={post.title} 
                        className="w-full h-full object-cover"
                    />
                </div>

                {/* Content */}
                <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:tracking-tight prose-a:text-primary prose-img:rounded-xl">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {post.content}
                    </ReactMarkdown>
                </div>

                {/* Tags & Share */}
                <footer className="mt-16 pt-8 border-t space-y-8">
                    <div className="flex flex-wrap gap-2">
                        {post.tags.map(tag => (
                            <span key={tag} className="px-3 py-1 bg-muted rounded-full text-xs font-medium text-muted-foreground">
                                #{tag}
                            </span>
                        ))}
                    </div>
                    
                    <div className="bg-primary/5 rounded-2xl p-8 text-center space-y-4">
                        <h3 className="text-xl font-bold">¿Te gustó este artículo?</h3>
                        <p className="text-muted-foreground max-w-md mx-auto">
                            Kurso ayuda a tesoreros y centros de padres a digitalizar sus finanzas en minutos. 
                            Únete a cientos de comunidades escolares transparentes.
                        </p>
                        <Button asChild size="lg" className="rounded-full shadow-lg">
                            <Link to="/auth?mode=signup">Comenzar ahora gratis</Link>
                        </Button>
                    </div>
                </footer>
            </article>

            {/* Bottom Footer */}
            <footer className="py-20 border-t bg-muted/20">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Kurso.app | Parte del ecosistema HojaCero</p>
                    <div className="mt-4 flex justify-center gap-6 text-xs font-medium text-muted-foreground/60">
                        <Link to="/" className="hover:text-primary transition-colors">Inicio</Link>
                        <Link to="/blog" className="hover:text-primary transition-colors">Blog</Link>
                        <a href="https://hojacero.cl" className="hover:text-primary transition-colors">HojaCero</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default BlogPost;
