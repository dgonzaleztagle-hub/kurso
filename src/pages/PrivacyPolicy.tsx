import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Politica de Privacidad | Kurso</title>
        <meta
          name="description"
          content="Politica de privacidad de Kurso para usuarios web, iPhone y Android."
        />
        <link rel="canonical" href="https://mikurso.cl/privacy-policy" />
      </Helmet>

      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Kurso</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">Politica de Privacidad</h1>
            <p className="mt-3 text-muted-foreground">
              Ultima actualizacion: 12 de marzo de 2026.
            </p>
          </div>
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            Volver al inicio
          </Link>
        </div>

        <div className="space-y-8 text-sm leading-7 text-muted-foreground">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">1. Quien opera Kurso</h2>
            <p>
              Kurso es una plataforma de gestion escolar operada por HojaCero para administrar
              pagos, rendiciones, alumnos, apoderados y comunicacion asociada a cursos y
              comunidades escolares.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. Datos que podemos tratar</h2>
            <p>Dependiendo del rol del usuario y del uso de la plataforma, Kurso puede tratar:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Datos de cuenta, como nombre, correo y credenciales de acceso.</li>
              <li>Datos de contacto, como telefono cuando sean ingresados por el usuario o la organizacion.</li>
              <li>Datos operativos del curso, como alumnos, apoderados, membresias y permisos.</li>
              <li>Datos financieros, como pagos, deudas, notificaciones de pago, gastos y rendiciones.</li>
              <li>Registros tecnicos necesarios para seguridad, soporte y auditoria.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">3. Para que usamos los datos</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Permitir acceso seguro a la plataforma.</li>
              <li>Operar funciones de tesoreria, pagos y rendiciones.</li>
              <li>Gestionar roles, permisos y relacion entre usuarios y tenants.</li>
              <li>Prestar soporte y resolver incidentes.</li>
              <li>Cumplir obligaciones legales, contables o de seguridad.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">4. Base operativa y terceros</h2>
            <p>
              Kurso utiliza servicios de infraestructura y operacion para funcionar, incluyendo
              hosting, base de datos, autenticacion y procesamiento de pagos. Estos proveedores
              solo acceden a la informacion necesaria para prestar sus servicios.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">5. Conservacion y seguridad</h2>
            <p>
              Conservamos la informacion por el tiempo necesario para operar la plataforma,
              mantener trazabilidad financiera, resolver soporte y cumplir exigencias legales o
              contractuales. Aplicamos controles de seguridad razonables acordes al tipo de datos
              tratados.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">6. Derechos y solicitudes</h2>
            <p>
              Los usuarios pueden solicitar informacion, correccion o eliminacion segun corresponda
              al contexto de uso y a las obligaciones legales aplicables. Para eso, revisa nuestra
              pagina de privacidad y opciones de usuario.
            </p>
            <p>
              <Link to="/privacy-choices" className="font-medium text-primary hover:underline">
                Ver opciones de privacidad
              </Link>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">7. Contacto</h2>
            <p>
              Para soporte o solicitudes relacionadas con privacidad, contactanos en{" "}
              <a className="font-medium text-primary hover:underline" href="mailto:contacto@hojacero.cl">
                contacto@hojacero.cl
              </a>{" "}
              o por WhatsApp en{" "}
              <a className="font-medium text-primary hover:underline" href="https://wa.me/56954031472" target="_blank" rel="noreferrer">
                +56 9 5403 1472
              </a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
