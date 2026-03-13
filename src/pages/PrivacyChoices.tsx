import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const PrivacyChoices = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Opciones de Privacidad | Kurso</title>
        <meta
          name="description"
          content="Opciones de privacidad, derechos ARCO y eliminación de cuenta para usuarios de mikurso.cl."
        />
        <link rel="canonical" href="https://mikurso.cl/privacy-choices" />
      </Helmet>

      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Kurso</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">Opciones de Privacidad</h1>
            <p className="mt-3 text-muted-foreground">
              Esta página explica cómo ejercer derechos ARCO y cómo funciona la eliminación de cuenta en la app.
            </p>
          </div>
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            Volver al inicio
          </Link>
        </div>

        <div className="space-y-8 text-sm leading-7 text-muted-foreground">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Solicitudes disponibles</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Solicitar informacion sobre los datos asociados a tu cuenta.</li>
              <li>Solicitar correccion de datos inexactos.</li>
              <li>Solicitar eliminacion cuando sea procedente y no exista obligacion legal de retencion.</li>
              <li>Solicitar cierre de cuenta o revision de acceso.</li>
              <li>Solicitar acceso, rectificacion, cancelacion u oposicion conforme a Ley 19.628.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Como solicitarlo</h2>
            <p>
              Puedes usar el formulario en{" "}
              <Link to="/soporte" className="font-medium text-primary hover:underline">
                /soporte
              </Link>{" "}
              o escribir a{" "}
              <a className="font-medium text-primary hover:underline" href="mailto:contacto@hojacero.cl">
                contacto@hojacero.cl
              </a>{" "}
              indicando:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Nombre de la organizacion o curso.</li>
              <li>Correo asociado a la cuenta.</li>
              <li>Tipo de solicitud.</li>
              <li>Detalle suficiente para identificar el caso.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Eliminacion de cuenta</h2>
            <p>
              mikurso.cl permite iniciar la eliminación de cuenta desde el perfil del usuario autenticado.
              El proceso elimina el acceso, anonimiza datos personales sensibles del perfil y conserva solo
              los registros contables estrictamente necesarios para continuidad y auditoría del curso.
            </p>
            <p>
              Si la cuenta mantiene la propiedad del curso como owner, puede exigirse transferencia previa
              para evitar dejar el tenant sin administración responsable.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Canal alternativo</h2>
            <p>
              Si necesitas contexto adicional, también puedes usar el correo de soporte oficial.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default PrivacyChoices;
