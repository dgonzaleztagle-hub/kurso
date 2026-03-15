import { Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Building2,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServiceLayout } from "@/components/layouts/ServiceLayout";
import { resolveBranding } from "@/lib/branding";
import { SEO_PAGE_CONFIGS, type SeoFeatureItem, type SeoPageId } from "@/data/seoPages";
import NotFound from "./NotFound";

const PAGE_ICON_MAP: Record<(typeof SEO_PAGE_CONFIGS)[SeoPageId]["icon"], LucideIcon> = {
  graduation: GraduationCap,
  building: Building2,
  wallet: Wallet,
  users: Users,
  chart: BarChart3,
  shield: ShieldCheck,
};

const FEATURE_ICON_MAP: Record<SeoFeatureItem["icon"], LucideIcon> = {
  wallet: Wallet,
  bell: Bell,
  shield: ShieldCheck,
  users: Users,
  chart: BarChart3,
  check: CheckCircle2,
};

const SeoPage = () => {
  const location = useLocation();
  const branding = resolveBranding();
  const page = Object.values(SEO_PAGE_CONFIGS).find((item) => item.path === location.pathname);

  if (!page) {
    return <NotFound />;
  }

  const canonicalUrl = `https://mikurso.cl${page.path}`;
  const Icon = PAGE_ICON_MAP[page.icon];

  const faqSchema = page.faq.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  }));

  return (
    <>
      <Helmet>
        <title>{page.metaTitle}</title>
        <meta name="description" content={page.metaDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={page.metaTitle} />
        <meta property="og:description" content={page.metaDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content="https://mikurso.cl/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={page.metaTitle} />
        <meta name="twitter:description" content={page.metaDescription} />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                name: page.title,
                description: page.metaDescription,
                url: canonicalUrl,
              },
              {
                "@type": "SoftwareApplication",
                name: branding.appName,
                applicationCategory: "FinanceApplication",
                operatingSystem: "Web, Android, iOS",
                description: page.metaDescription,
                url: canonicalUrl,
                offers: {
                  "@type": "Offer",
                  priceCurrency: "CLP",
                  price: "9900",
                },
              },
              {
                "@type": "FAQPage",
                mainEntity: faqSchema,
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
                    name: page.title,
                    item: canonicalUrl,
                  },
                ],
              },
            ],
          })}
        </script>
      </Helmet>

      <ServiceLayout title={page.title} subtitle={page.subtitle} icon={Icon} colorClass={page.colorClass}>
        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            SEO Landing
          </div>
          <h2 className="text-3xl font-bold tracking-tight">{page.introHeading}</h2>
          <div className="space-y-4 text-base leading-8 text-muted-foreground">
            {page.introParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-3xl font-bold tracking-tight">Qué resuelve Kurso en la práctica</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {page.features.map((feature) => {
              const FeatureIcon = FEATURE_ICON_MAP[feature.icon];
              return (
                <article key={feature.title} className="rounded-3xl border bg-card p-6 shadow-sm">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <FeatureIcon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{feature.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-3xl font-bold tracking-tight">Por qué esto reduce trabajo manual</h2>
          <div className="rounded-3xl border bg-muted/30 p-8">
            <ul className="space-y-4">
              {page.bulletPoints.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                  <span className="leading-7 text-foreground/90">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-3xl font-bold tracking-tight">{page.comparisonHeading}</h2>
          <div className="overflow-hidden rounded-3xl border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-4 py-4 font-semibold text-foreground">Criterio</th>
                  <th className="px-4 py-4 font-semibold text-foreground">Base / Gratis</th>
                  <th className="px-4 py-4 font-semibold text-foreground">Profesional</th>
                </tr>
              </thead>
              <tbody>
                {page.comparisonRows.map((row) => (
                  <tr key={row.label} className="border-t align-top">
                    <td className="px-4 py-4 font-medium text-foreground">{row.label}</td>
                    <td className="px-4 py-4 leading-7 text-muted-foreground">{row.basic}</td>
                    <td className="px-4 py-4 leading-7 text-muted-foreground">{row.professional}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-3xl font-bold tracking-tight">Preguntas frecuentes</h2>
          <div className="space-y-4">
            {page.faq.map((item) => (
              <article key={item.question} className="rounded-2xl border bg-card/60 p-6">
                <h3 className="text-lg font-semibold tracking-tight">{item.question}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border bg-primary/5 p-8">
            <h2 className="text-3xl font-bold tracking-tight">{page.ctaTitle}</h2>
            <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">{page.ctaBody}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full px-8">
                <Link to="/auth?mode=signup">{page.ctaLabel}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-8">
                <Link to="/soporte">Hablar con soporte</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">Sigue explorando</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {page.relatedLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="group flex items-center justify-between rounded-2xl border bg-card px-5 py-4 transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                <span className="font-medium tracking-tight">{link.title}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </section>
      </ServiceLayout>
    </>
  );
};

export default SeoPage;
