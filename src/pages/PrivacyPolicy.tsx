import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { resolveBranding } from "@/lib/branding";

const branding = resolveBranding();

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Privacidad | {branding.appName}</title>
        <meta
          name="description"
          content="Politica de privacidad y tratamiento de datos personales de mikurso.cl, incluyendo datos de menores, ARCO y eliminacion de cuenta."
        />
        <link rel="canonical" href="https://mikurso.cl/privacidad" />
      </Helmet>

      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">mikurso.cl</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">Política de Privacidad</h1>
            <p className="mt-3 text-muted-foreground">
              Última actualización: 13 de marzo de 2026.
            </p>
          </div>
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            Volver al inicio
          </Link>
        </div>

        <div className="space-y-8 text-sm leading-7 text-muted-foreground">
          <section className="space-y-3 rounded-2xl border bg-card p-6">
            <h2 className="text-xl font-semibold text-foreground">1. Responsable del tratamiento</h2>
            <p>
              El responsable del tratamiento de los datos personales tratados en mikurso.cl es{" "}
              <strong className="text-foreground">{branding.legalName}</strong>, desarrollador y
              operador de la plataforma mikurso.cl.
            </p>
            <p>
              Esta política se aplica al uso web, móvil, PWA y empaquetados para App Store y Google Play.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. Marco de tratamiento</h2>
            <p>
              mikurso.cl trata datos personales conforme a la Ley N.º 19.628 sobre Protección de la Vida Privada
              de Chile, a las obligaciones operativas y contables del curso o institución, y a los lineamientos de
              privacidad exigidos por Apple y Google para aplicaciones que manejan cuentas de usuario y datos de menores.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">3. Datos recolectados</h2>
            <p>La plataforma puede recolectar y procesar las siguientes categorías de datos:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Nombres y apellidos de estudiantes, apoderados y usuarios operativos.</li>
              <li>RUT de estudiantes cuando la institución lo usa para matrícula, control interno o creación de cuenta.</li>
              <li>Fecha de matrícula del estudiante.</li>
              <li>Datos de contacto de apoderados y usuarios, como email y teléfono.</li>
              <li>Datos operativos y financieros asociados al curso, como pagos, cuotas mensuales, notificaciones, créditos, exclusiones, donaciones y rendiciones.</li>
              <li>Registros de auditoría, seguridad y soporte para trazabilidad administrativa.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">4. Finalidad del tratamiento</h2>
            <p>Los datos se utilizan exclusivamente para las siguientes finalidades:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong className="text-foreground">Gestión financiera:</strong> registro de pagos, cobro de cuotas mensuales,
                control de morosidad, estado de cuenta, créditos a favor y conciliación administrativa.
              </li>
              <li>
                <strong className="text-foreground">Gestión operativa:</strong> inscripción en actividades, control de exclusiones,
                calendarización, donaciones y gestión de formularios.
              </li>
              <li>
                <strong className="text-foreground">Comunicación institucional:</strong> publicación de anuncios, actas de reunión,
                notificaciones internas y soporte operacional.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">5. Privacidad de menores</h2>
            <p>
              El registro de datos de estudiantes es realizado por el <strong className="text-foreground">Owner</strong> o el{" "}
              <strong className="text-foreground">Staff/Admin</strong> del curso bajo el consentimiento explícito de la institución,
              del apoderado o del responsable habilitado por el establecimiento.
            </p>
            <p>
              Los datos de menores no se utilizan para perfiles publicitarios, remarketing, venta de audiencias ni publicidad comportamental.
              Tampoco se comparten con terceros externos al ecosistema operativo del curso, salvo proveedores de infraestructura estrictamente
              necesarios para alojar, autenticar y operar la plataforma.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border bg-card p-6">
            <h2 className="text-xl font-semibold text-foreground">6. Arquitectura de seguridad multitenant</h2>
            <p>
              Cada curso funciona como una unidad aislada dentro de la arquitectura multitenant de Kurso.
              Los datos de una organización o curso no son accesibles para otra.
            </p>
            <p>
              El aislamiento se aplica a nivel de autenticación, membresía por tenant, políticas de acceso y consultas de datos,
              de modo que cada curso opera como su propio espacio administrativo.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">7. Conservación de datos</h2>
            <p>
              Los datos se conservan durante el tiempo necesario para operar el curso, responder soporte, mantener trazabilidad de la administración
              y cumplir exigencias legales, contables o contractuales aplicables.
            </p>
            <p>
              Cuando un usuario solicita la eliminación de su cuenta, mikurso.cl elimina el acceso autenticado y anonimiza los datos personales
              sensibles del perfil cuando corresponde, manteniendo únicamente los registros contables u operativos que deban conservarse para la continuidad
              del curso, la integridad de los libros internos y la transparencia administrativa.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">8. Derechos del usuario y flujo ARCO</h2>
            <p>
              Los usuarios pueden ejercer sus derechos de Acceso, Rectificación, Cancelación y Oposición (ARCO), además de solicitar revisión de datos
              o eliminación de cuenta, utilizando los canales internos de privacidad y soporte.
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li><strong className="text-foreground">Acceso:</strong> solicitar información sobre los datos asociados a la cuenta.</li>
              <li><strong className="text-foreground">Rectificación:</strong> corregir datos inexactos o incompletos.</li>
              <li><strong className="text-foreground">Cancelación:</strong> pedir eliminación o anonimización cuando proceda.</li>
              <li><strong className="text-foreground">Oposición:</strong> objetar tratamientos que no sean imprescindibles para el servicio.</li>
            </ul>
            <p>
              Para solicitudes ARCO puedes usar la página de{" "}
              <Link to="/privacy-choices" className="font-medium text-primary hover:underline">
                Derechos ARCO
              </Link>{" "}
              o el canal de{" "}
              <Link to="/soporte" className="font-medium text-primary hover:underline">
                Soporte
              </Link>.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border bg-card p-6">
            <h2 className="text-xl font-semibold text-foreground">9. Eliminación de cuenta desde la app</h2>
            <p>
              mikurso.cl incluye una función de eliminación de cuenta disponible desde el perfil o centro de cuenta del usuario autenticado.
            </p>
            <p>
              Al usar esta función, la plataforma:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>elimina el acceso autenticado de la cuenta;</li>
              <li>anonimiza datos sensibles del perfil, como correo, teléfono y, cuando corresponde, RUT;</li>
              <li>conserva únicamente los registros contables u operativos que deban permanecer por continuidad del curso.</li>
            </ul>
            <p>
              Si una cuenta mantiene la titularidad del curso como <strong className="text-foreground">Owner</strong>, la eliminación puede requerir
              una transferencia previa de propiedad para no dejar el curso sin administración responsable.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">10. Contacto</h2>
            <p>
              Para consultas de privacidad, soporte o ejercicio de derechos, escríbenos a{" "}
              <a className="font-medium text-primary hover:underline" href="mailto:contacto@hojacero.cl">
                contacto@hojacero.cl
              </a>{" "}
              o utiliza el formulario disponible en{" "}
              <Link to="/soporte" className="font-medium text-primary hover:underline">
                /soporte
              </Link>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
