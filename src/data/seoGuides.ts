export type SeoGuideId =
  | "como-llevar-la-tesoreria-de-un-curso"
  | "como-cobrar-cuotas-de-curso-sin-whatsapp"
  | "como-rendir-gastos-de-curso-a-apoderados"
  | "errores-comunes-del-tesorero-de-curso"
  | "planilla-vs-software-para-tesoreria-escolar";

export interface SeoGuideConfig {
  id: SeoGuideId;
  path: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  date: string;
  author: string;
  category: string;
  image: string;
  content: string;
}

export const SEO_GUIDE_CONFIGS: Record<SeoGuideId, SeoGuideConfig> = {
  "como-llevar-la-tesoreria-de-un-curso": {
    id: "como-llevar-la-tesoreria-de-un-curso",
    path: "/como-llevar-la-tesoreria-de-un-curso",
    title: "Cómo llevar la tesorería de un curso sin convertirte en cobrador y auditor al mismo tiempo",
    metaTitle: "Cómo llevar la tesorería de un curso | Guía práctica para apoderados | Kurso",
    metaDescription: "Aprende cómo llevar la tesorería de un curso con menos desorden, mejor rendición de cuentas y más claridad para apoderados y directivas.",
    excerpt: "Una guía práctica para organizar cuotas, gastos y rendiciones del curso sin depender de memoria, chats o planillas inmanejables.",
    date: "2026-03-15",
    author: "Equipo Kurso",
    category: "Guías",
    image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=2068&auto=format&fit=crop",
    content: `
# Cómo llevar la tesorería de un curso

Llevar la tesorería de un curso parece simple hasta que empiezan a acumularse cuotas pendientes, gastos sin respaldo y preguntas por WhatsApp. El problema no es solo registrar dinero: es **mantener orden, continuidad y confianza**.

## 1. Define reglas simples desde el inicio

Antes de cobrar la primera cuota, responde estas preguntas:

- ¿Qué se va a cobrar?
- ¿Cada cuánto se cobra?
- ¿Cómo se registran los pagos?
- ¿Cómo se rinden los gastos?
- ¿Quién puede revisar la información?

## 2. Evita depender de una sola persona

Uno de los errores más frecuentes es que toda la información quede en el celular, correo o planilla del tesorero. Si esa persona se enferma, renuncia o simplemente se cansa, el curso pierde trazabilidad.

## 3. Registra cada ingreso y gasto con contexto

No basta con anotar “pagó” o “se compró algo”. Registra fecha, monto, motivo, respaldo y persona o alumno asociado. Mientras más contexto tenga cada movimiento, más fácil será explicar el balance.

## 4. Rinde cuentas de forma continua, no solo en crisis

La peor rendición es la que se prepara el día anterior a la reunión. Lo ideal es mantener una rutina:

1. registrar pagos en cuanto ocurren
2. subir o guardar respaldos de gastos
3. revisar saldo disponible
4. compartir un resumen simple de manera periódica

## Conclusión

Llevar bien la tesorería de un curso no se trata de ser contador. Se trata de tener reglas claras, un registro confiable y una forma simple de rendir cuentas sin desgaste innecesario.
    `,
  },
  "como-cobrar-cuotas-de-curso-sin-whatsapp": {
    id: "como-cobrar-cuotas-de-curso-sin-whatsapp",
    path: "/como-cobrar-cuotas-de-curso-sin-whatsapp",
    title: "Cómo cobrar cuotas de curso sin convertir WhatsApp en una oficina de cobranza",
    metaTitle: "Cómo cobrar cuotas de curso sin WhatsApp | Menos fricción para apoderados | Kurso",
    metaDescription: "Descubre cómo cobrar cuotas de curso sin depender de WhatsApp, reducir fricción con apoderados y ordenar mejor el seguimiento de pagos.",
    excerpt: "Cobrar por WhatsApp parece práctico hasta que se vuelve una fuente constante de desgaste. Esta guía muestra cómo bajar la fricción y ordenar el seguimiento.",
    date: "2026-03-15",
    author: "Equipo Kurso",
    category: "Cobranza",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070&auto=format&fit=crop",
    content: `
# Cómo cobrar cuotas de curso sin WhatsApp

WhatsApp resuelve rápido, pero rara vez ordena bien. Cuando la cobranza del curso depende del chat, aparecen tres problemas:

- los mensajes se pierden
- la información queda dispersa
- el tesorero termina haciendo seguimiento manual todo el tiempo

## Qué hacer en vez de eso

### 1. Define un canal formal para informar pagos

El chat puede seguir existiendo, pero no debería ser la fuente principal de verdad. Lo importante es que exista un lugar claro donde revisar cuánto se debía, cuánto se pagó y qué queda pendiente.

### 2. Evita la cobranza improvisada

No cobres “cuando te acuerdes” o “cuando alguien pregunte”. La cobranza mejora cuando tiene periodicidad, formato consistente e información clara.

### 3. Separa recordatorio de presión social

No todo debe ir al chat grupal. Muchas veces la cobranza se vuelve incómoda porque mezcla información financiera con dinámica social.

## Conclusión

Cobrar cuotas sin WhatsApp no significa dejar de comunicarte. Significa que el chat deje de cargar con un trabajo administrativo para el que no fue diseñado.
    `,
  },
  "como-rendir-gastos-de-curso-a-apoderados": {
    id: "como-rendir-gastos-de-curso-a-apoderados",
    path: "/como-rendir-gastos-de-curso-a-apoderados",
    title: "Cómo rendir gastos de curso a apoderados sin improvisar a última hora",
    metaTitle: "Cómo rendir gastos de curso a apoderados | Guía de transparencia | Kurso",
    metaDescription: "Aprende cómo rendir gastos del curso a apoderados con claridad, respaldo y menos estrés para la directiva del curso.",
    excerpt: "La rendición de gastos no debería comenzar la noche anterior a la reunión. Esta guía explica cómo mantenerla clara, continua y defendible.",
    date: "2026-03-15",
    author: "Equipo Kurso",
    category: "Rendición",
    image: "https://images.unsplash.com/photo-1554224154-26032ffc0d07?q=80&w=2070&auto=format&fit=crop",
    content: `
# Cómo rendir gastos de curso a apoderados

Rendir gastos no es solo mostrar números. Es demostrar que la plata del curso fue usada con criterio, respaldo y orden.

## Qué debe tener una buena rendición

Una buena rendición incluye:

- ingresos recibidos
- gastos realizados
- saldo disponible
- respaldo o contexto de cada gasto importante

## Buenas prácticas

1. registra el gasto cuando ocurre
2. guarda el respaldo junto al movimiento
3. usa categorías entendibles
4. habla en lenguaje comprensible
5. rinde de forma periódica

## Conclusión

Rendir gastos bien es más fácil cuando no dependes de memoria, chats o carpetas dispersas. Si el curso registra movimientos con contexto y respaldo desde el principio, la rendición deja de ser una crisis y se vuelve parte natural del trabajo.
    `,
  },
  "errores-comunes-del-tesorero-de-curso": {
    id: "errores-comunes-del-tesorero-de-curso",
    path: "/errores-comunes-del-tesorero-de-curso",
    title: "Errores comunes del tesorero de curso y cómo evitarlos antes de que generen conflicto",
    metaTitle: "Errores comunes del tesorero de curso | Qué evitar en la gestión | Kurso",
    metaDescription: "Conoce los errores más comunes del tesorero de curso y aprende cómo evitarlos para reducir desorden, mora y conflictos con apoderados.",
    excerpt: "No hace falta mala gestión para que un curso entre en conflicto. Muchas veces basta con repetir errores pequeños que se acumulan mes a mes.",
    date: "2026-03-15",
    author: "Equipo Kurso",
    category: "Consejos",
    image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?q=80&w=2068&auto=format&fit=crop",
    content: `
# Errores comunes del tesorero de curso

El problema del tesorero de curso no suele ser la falta de compromiso. Casi siempre el problema es intentar administrar una operación real con herramientas improvisadas.

## Errores frecuentes

1. guardar todo en una sola planilla personal
2. cobrar por intuición
3. registrar tarde
4. mezclar transparencia con sobreexplicación
5. no separar ingresos normales de extraordinarios
6. preparar la rendición solo antes de la reunión

## Cómo evitarlos

1. centraliza información
2. registra cada movimiento a tiempo
3. usa categorías simples
4. mantén visible el estado de pagos
5. guarda respaldos junto al gasto

## Conclusión

La mayoría de los conflictos financieros en cursos no nace de grandes errores. Nace de pequeños vacíos de orden. Corregirlos temprano ahorra tiempo, reduce desgaste y mejora la confianza de toda la comunidad.
    `,
  },
  "planilla-vs-software-para-tesoreria-escolar": {
    id: "planilla-vs-software-para-tesoreria-escolar",
    path: "/planilla-vs-software-para-tesoreria-escolar",
    title: "Planilla vs software para tesorería escolar: cuál conviene según el momento del curso",
    metaTitle: "Planilla vs software para tesorería escolar | Comparativa práctica | Kurso",
    metaDescription: "Compara usar una planilla o un software para tesorería escolar y descubre cuándo conviene pasar a una plataforma más profesional.",
    excerpt: "La planilla no siempre es un error. El punto es entender cuándo deja de ayudar y empieza a generar más trabajo del que ahorra.",
    date: "2026-03-15",
    author: "Equipo Kurso",
    category: "Comparativas",
    image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=2011&auto=format&fit=crop",
    content: `
# Planilla vs software para tesorería escolar

Una planilla puede ser suficiente al principio. El problema aparece cuando el curso empieza a necesitar más seguimiento, más transparencia y menos dependencia de la persona que la mantiene.

## Cuándo una planilla todavía sirve

- el curso recién empieza
- hay pocos movimientos
- la operación es simple

## Cuándo empieza a quedarse corta

- hay cuotas mensuales por varios meses
- aparecen pagos parciales
- la directiva necesita rendir cuentas seguido
- los apoderados piden visibilidad

## Conclusión

La pregunta real es cuánto tiempo y credibilidad está costando seguir con la planilla actual. Si la operación ya te quita tiempo todas las semanas, probablemente el software sea más barato de lo que parece.
    `,
  },
};
