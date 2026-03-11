import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { BookOpen, Calendar, User, ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BLOG_POSTS } from "@/data/blogData";
import { resolveBranding } from "@/lib/branding";

const Blog = () => {
    const branding = resolveBranding();

    const stagger = {
        animate: {
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const fadeInUp = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5 }
    };

    return (
        <div className="min-h-screen bg-background">
            <Helmet>
                <title>Blog de Tesorería Escolar | Consejos para Padres y Cursos | Kurso</title>
                <meta name="description" content="Aprende sobre gestión financiera escolar, consejos para tesoreros de curso y transparencia en centros de padres con los artículos expertos de Kurso." />
                <link rel="canonical" href="https://kurso.app/blog" />
            </Helmet>

            {/* Header / Navbar Lite */}
            <nav className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                        <img src={branding.iconUrl} alt={branding.appName} className="h-8 w-8 object-contain" />
                        <span className="font-bold text-xl tracking-tight">{branding.appName}</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link to="/auth" className="text-sm font-medium hover:text-primary transition-colors">Ingresar</Link>
                        <Button asChild size="sm">
                            <Link to="/auth?mode=signup">Probar Gratis</Link>
                        </Button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="py-20 bg-primary/5 relative overflow-hidden">
                <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,var(--tw-gradient-from),transparent_50%)] from-primary/10" />
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-4"
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                            <BookOpen className="h-3 w-3" />
                            AEO Center & Knowledge Base
                        </div>
                        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">Blog de Tesorería Escolar</h1>
                        <p className="max-w-2xl mx-auto text-muted-foreground text-lg">
                            Recursos, guías y consejos profesionales para gestionar las finanzas de tu comunidad escolar con transparencia y tecnología.
                        </p>
                    </motion.div>
                </div>
            </header>

            {/* Blog Grid */}
            <main className="max-w-7xl mx-auto px-4 py-16">
                <motion.div 
                    variants={stagger}
                    initial="initial"
                    animate="animate"
                    className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
                >
                    {BLOG_POSTS.map((post) => (
                        <motion.div key={post.id} variants={fadeInUp}>
                            <Card className="h-full flex flex-col overflow-hidden hover:shadow-xl hover:border-primary/20 transition-all group">
                                <div className="aspect-video relative overflow-hidden">
                                    <img 
                                        src={post.image} 
                                        alt={post.title} 
                                        className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500"
                                    />
                                    <div className="absolute top-4 left-4">
                                        <span className="px-2 py-1 bg-background/90 backdrop-blur-sm text-[10px] font-bold uppercase rounded-md shadow-sm">
                                            {post.category}
                                        </span>
                                    </div>
                                </div>
                                <CardHeader className="flex-1">
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {format(new Date(post.date), "d MMM, yyyy", { locale: es })}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <User className="h-3 w-3" />
                                            {post.author}
                                        </span>
                                    </div>
                                    <CardTitle className="line-clamp-2 hover:text-primary transition-colors cursor-pointer">
                                        <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-muted-foreground text-sm line-clamp-3 leading-relaxed">
                                        {post.excerpt}
                                    </p>
                                </CardContent>
                                <CardFooter className="pt-0">
                                    <Button asChild variant="ghost" className="p-0 h-auto font-bold hover:bg-transparent hover:text-primary group/link">
                                        <Link to={`/blog/${post.slug}`} className="flex items-center gap-2">
                                            Leer Artículo Completo
                                            <ArrowRight className="h-4 w-4 group-hover/link:translate-x-1 transition-transform" />
                                        </Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    ))}
                </motion.div>
            </main>

            {/* Newsletter Lite */}
            <section className="bg-muted/50 py-24 border-y">
                <div className="max-w-4xl mx-auto px-4 text-center space-y-8">
                    <h2 className="text-3xl font-bold">Domina la Tesorería de tu Curso</h2>
                    <p className="text-muted-foreground">Suscríbete para recibir herramientas gratuitas y consejos de gestión directamente en tu correo.</p>
                    <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                        <div className="flex-1 bg-background rounded-full border px-4 py-2 flex items-center">
                            <input 
                                type="email" 
                                placeholder="tu@correo.com" 
                                className="bg-transparent border-none outline-none w-full text-sm"
                            />
                        </div>
                        <Button className="rounded-full px-8">Suscribirse</Button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t text-center">
                 <div className="flex justify-center items-center gap-2 mb-4">
                    <img src={branding.iconUrl} alt={branding.appName} className="h-5 w-5 grayscale opacity-50" />
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Kurso Ecosystem</span>
                 </div>
                 <p className="text-xs text-muted-foreground">Powered by HojaCero.cl | Engineering for Tomorrow</p>
            </footer>
        </div>
    );
};

export default Blog;
