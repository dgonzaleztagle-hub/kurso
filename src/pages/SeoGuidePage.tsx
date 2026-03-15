import { Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Calendar, ChevronRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SEO_GUIDE_CONFIGS } from "@/data/seoGuides";
import { resolveBranding } from "@/lib/branding";
import NotFound from "./NotFound";

const SeoGuidePage = () => {
  const location = useLocation();
  const branding = resolveBranding();
  const guide = Object.values(SEO_GUIDE_CONFIGS).find((item) => item.path === location.pathname);

  if (!guide) {
    return <NotFound />;
  }

  const canonicalUrl = `https://mikurso.cl${guide.path}`;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{guide.metaTitle}</title>
        <meta name="description" content={guide.metaDescription} />
        <meta name="author" content={guide.author} />
        <meta property="og:title" content={guide.metaTitle} />
        <meta property="og:description" content={guide.metaDescription} />
        <meta property="og:image" content={guide.image} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={canonicalUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="canonical" href={canonicalUrl} />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Article",
                headline: guide.title,
                description: guide.metaDescription,
                image: guide.image,
                author: {
                  "@type": "Person",
                  name: guide.author,
                },
                publisher: {
                  "@type": "Organization",
                  name: branding.appName,
                  logo: {
                    "@type": "ImageObject",
                    url: branding.logoUrl,
                  },
                },
                datePublished: guide.date,
                dateModified: guide.date,
                mainEntityOfPage: canonicalUrl,
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: "Inicio",
                    item: "https://mikurso.cl/",
                  },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "Blog",
                    item: "https://mikurso.cl/blog",
                  },
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: guide.title,
                    item: canonicalUrl,
                  },
                ],
              },
            ],
          })}
        </script>
      </Helmet>

      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link to="/blog" className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Volver al blog
          </Link>
          <Button asChild size="sm" className="rounded-full">
            <Link to="/auth?mode=signup">Probar Kurso</Link>
          </Button>
        </div>
      </nav>

      <article className="mx-auto max-w-4xl px-4 py-12 md:py-20">
        <header className="mb-12 space-y-6">
          <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            {guide.category}
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl">{guide.title}</h1>
          <p className="max-w-3xl text-lg leading-8 text-muted-foreground">{guide.excerpt}</p>
          <div className="flex flex-wrap items-center gap-4 border-t pt-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {guide.author}
            </span>
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(new Date(guide.date), "d 'de' MMMM, yyyy", { locale: es })}
            </span>
          </div>
        </header>

        <div className="mb-12 aspect-[21/9] overflow-hidden rounded-3xl shadow-xl">
          <img src={guide.image} alt={guide.title} className="h-full w-full object-cover" />
        </div>

        <div className="prose prose-lg max-w-none prose-headings:tracking-tight prose-a:text-primary dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{guide.content}</ReactMarkdown>
        </div>

        <footer className="mt-16 space-y-6 border-t pt-8">
          <div className="rounded-3xl border bg-primary/5 p-8">
            <h2 className="text-2xl font-bold tracking-tight">Pasa de la guía a una operación más ordenada</h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
              Kurso ayuda a cursos y directivas a controlar cuotas, pagos, gastos y rendiciones sin depender de Excel ni de cobros por WhatsApp.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full px-8">
                <Link to="/tesoreria-escolar">Ver solución</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-8">
                <Link to="/auth?mode=signup">Crear cuenta</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Link
              to="/tesoreria-escolar"
              className="group flex items-center justify-between rounded-2xl border bg-card px-5 py-4 transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
              <span className="font-medium">Tesorería escolar</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </Link>
            <Link
              to="/control-cuotas-curso"
              className="group flex items-center justify-between rounded-2xl border bg-card px-5 py-4 transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
              <span className="font-medium">Control de cuotas del curso</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </Link>
          </div>
        </footer>
      </article>
    </div>
  );
};

export default SeoGuidePage;
