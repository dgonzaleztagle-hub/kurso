import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const Support = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Soporte | Kurso</title>
        <meta
          name="description"
          content="Canales oficiales de soporte de Kurso para usuarios, administradores y revisores de App Store."
        />
        <link rel="canonical" href="https://mikurso.cl/support" />
      </Helmet>

      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Kurso</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">Soporte</h1>
            <p className="mt-3 text-muted-foreground">
              Canal oficial de contacto para soporte operativo, tecnico y revision.
            </p>
          </div>
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            Volver al inicio
          </Link>
        </div>

        <div className="space-y-8 text-sm leading-7 text-muted-foreground">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Contacto principal</h2>
            <p>
              Email:{" "}
              <a className="font-medium text-primary hover:underline" href="mailto:contacto@hojacero.cl">
                contacto@hojacero.cl
              </a>
            </p>
            <p>
              WhatsApp:{" "}
              <a className="font-medium text-primary hover:underline" href="https://wa.me/56954031472" target="_blank" rel="noreferrer">
                +56 9 5403 1472
              </a>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Sitio oficial</h2>
            <p>
              <a className="font-medium text-primary hover:underline" href="https://mikurso.cl" target="_blank" rel="noreferrer">
                https://mikurso.cl
              </a>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Soporte para App Review</h2>
            <p>
              Si Apple requiere contexto de acceso, demo o pasos de reproduccion, esa informacion
              debe ingresarse en App Store Connect dentro de App Review Information.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Support;
