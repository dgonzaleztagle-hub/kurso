export type SeoPageId =
  | "tesoreria-escolar"
  | "gestion-financiera-cursos-escolares"
  | "control-cuotas-curso"
  | "pagos-apoderados"
  | "gastos-e-ingresos-curso"
  | "software-tesorero-de-curso"
  | "tesoreria-escolar-gratis-vs-profesional"
  | "alternativa-a-excel-para-cuotas"
  | "alternativa-a-tesoreroescolar";

export interface SeoFaqItem {
  question: string;
  answer: string;
}

export interface SeoFeatureItem {
  title: string;
  description: string;
  icon: "wallet" | "bell" | "shield" | "users" | "chart" | "check";
}

export interface SeoComparisonRow {
  label: string;
  basic: string;
  professional: string;
}

export interface SeoRelatedLink {
  title: string;
  path: string;
}

export interface SeoPageConfig {
  id: SeoPageId;
  path: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  subtitle: string;
  icon: "graduation" | "building" | "wallet" | "users" | "chart" | "shield";
  colorClass: string;
  introHeading: string;
  introParagraphs: string[];
  features: SeoFeatureItem[];
  bulletPoints: string[];
  comparisonHeading: string;
  comparisonRows: SeoComparisonRow[];
  faq: SeoFaqItem[];
  relatedLinks: SeoRelatedLink[];
  ctaTitle: string;
  ctaBody: string;
  ctaLabel: string;
}

export const SEO_PAGE_CONFIGS: Record<SeoPageId, SeoPageConfig> = {
  "tesoreria-escolar": {
    id: "tesoreria-escolar",
    path: "/tesoreria-escolar",
    title: "Tesorería escolar con menos Excel, menos cobros manuales y más control",
    metaTitle: "Tesorería Escolar en Chile | Control de cuotas, gastos y apoderados | Kurso",
    metaDescription:
      "Kurso moderniza la tesorería escolar en Chile. Controla cuotas, pagos de apoderados, gastos y rendiciones con menos trabajo manual y más confianza.",
    subtitle:
      "Kurso transforma la tesorería escolar en un proceso ordenado, transparente y fácil de seguir para directivas, tesoreros y apoderados.",
    icon: "graduation",
    colorClass: "bg-blue-500/10 text-blue-500",
    introHeading: "La tesorería escolar no debería depender de planillas eternas ni cobros por WhatsApp",
    introParagraphs: [
      "La mayoría de los cursos parte con buenas intenciones y termina con desorden: transferencias sin identificar, cuotas pendientes, gastos difíciles de explicar y reuniones donde nadie entiende el balance.",
      "Kurso ordena la tesorería escolar con un sistema pensado para la realidad de Chile. Puedes registrar cuotas, controlar gastos, seguir deudas y compartir información clara con apoderados sin convertir al tesorero en cobrador a tiempo completo.",
    ],
    features: [
      { title: "Control de cuotas y pagos", description: "Registra pagos, deuda vigente y movimientos por alumno sin depender de planillas paralelas.", icon: "wallet" },
      { title: "Seguimiento simple para apoderados", description: "Cada familia puede revisar su estado y el uso del dinero del curso con claridad.", icon: "users" },
      { title: "Respaldo y trazabilidad", description: "Boletas, movimientos y reportes quedan centralizados en un solo lugar.", icon: "shield" },
    ],
    bulletPoints: [
      "Evita perder tiempo cuadrando pagos manualmente.",
      "Reduce preguntas repetidas en grupos de WhatsApp.",
      "Comparte balances entendibles en reuniones de apoderados.",
      "Mantén continuidad aunque cambie la directiva del curso.",
    ],
    comparisonHeading: "Gratis para empezar, profesional para ordenar y sostener",
    comparisonRows: [
      { label: "Cobranza y seguimiento", basic: "Recordatorios y seguimiento manual del tesorero.", professional: "Visibilidad clara, historial y menos persecución individual." },
      { label: "Orden de gastos", basic: "Comprobantes repartidos entre chats y carpetas.", professional: "Gastos, boletas y reportes centralizados." },
      { label: "Confianza de apoderados", basic: "Depende de explicaciones en cada reunión.", professional: "La información está disponible y ordenada." },
      { label: "Continuidad", basic: "Puede depender demasiado de una persona.", professional: "El curso mantiene su historial y estructura." },
    ],
    faq: [
      { question: "¿Kurso sirve solo para cursos o también para centros de padres?", answer: "Sirve para ambos. Puedes partir con la tesorería de un curso y escalar luego a una gestión más institucional si tu organización lo necesita." },
      { question: "¿Los apoderados ven toda la información financiera?", answer: "Ven la información que permite dar transparencia y seguimiento al curso, incluyendo estado de pagos y movimientos relevantes según el contexto del establecimiento." },
      { question: "¿Qué pasa si cambia el tesorero?", answer: "La información sigue centralizada en la plataforma, evitando que el historial dependa del teléfono, correo o planilla personal de una sola persona." },
    ],
    relatedLinks: [
      { title: "Control de cuotas del curso", path: "/control-cuotas-curso" },
      { title: "Pagos de apoderados", path: "/pagos-apoderados" },
      { title: "Cómo llevar la tesorería de un curso", path: "/como-llevar-la-tesoreria-de-un-curso" },
    ],
    ctaTitle: "Ordena la tesorería antes de que el desorden te consuma tiempo",
    ctaBody: "Empieza con un flujo más claro para cuotas, gastos y apoderados sin depender de Excel ni cobros manuales.",
    ctaLabel: "Probar Kurso",
  },
  "gestion-financiera-cursos-escolares": {
    id: "gestion-financiera-cursos-escolares",
    path: "/gestion-financiera-cursos-escolares",
    title: "Gestión financiera para cursos escolares con control real",
    metaTitle: "Gestión Financiera para Cursos Escolares | Kurso Chile",
    metaDescription: "Mejora la gestión financiera de tu curso escolar con seguimiento de cuotas, gastos, ingresos y reportes claros para apoderados y directivas.",
    subtitle: "Una plataforma para ordenar cuotas, gastos e ingresos del curso con más control operativo y menos carga manual para la directiva.",
    icon: "chart",
    colorClass: "bg-sky-500/10 text-sky-500",
    introHeading: "La gestión financiera de un curso no es solo transparencia: también es seguimiento y continuidad",
    introParagraphs: [
      "Cuando un curso recauda para materiales, paseos o actividades, la dificultad no está solo en registrar números. El problema real es sostener el orden mes a mes, avisar deudas, justificar gastos y responder preguntas sin volver todo un caos.",
      "Kurso entrega un sistema de gestión financiera para cursos escolares diseñado para que el tesorero dedique menos tiempo a perseguir pagos y más tiempo a mantener una operación clara y defendible frente a los apoderados.",
    ],
    features: [
      { title: "Ingresos y gastos en un mismo flujo", description: "Consulta la caja del curso con una visión simple y actualizada.", icon: "chart" },
      { title: "Menos trabajo manual", description: "Evita duplicar información entre chats, cuadernos y planillas.", icon: "check" },
      { title: "Más confianza para la directiva", description: "Rendir cuentas es más fácil cuando la información ya está ordenada.", icon: "shield" },
    ],
    bulletPoints: [
      "Controla fondos del curso sin improvisar reportes antes de cada reunión.",
      "Mantén una operación más seria aunque la directiva cambie durante el año.",
      "Da visibilidad a apoderados sin exponer al tesorero a explicaciones infinitas.",
      "Consolida el historial del curso en una sola plataforma.",
    ],
    comparisonHeading: "Qué cambia cuando la gestión financiera deja de ser artesanal",
    comparisonRows: [
      { label: "Estado del curso", basic: "Se reconstruye cuando alguien pregunta.", professional: "Está visible y actualizado." },
      { label: "Rendición", basic: "Se arma a mano antes de la reunión.", professional: "Se prepara desde el historial del sistema." },
      { label: "Seguimiento", basic: "Depende de memoria y mensajes sueltos.", professional: "Queda registrado por alumno y movimiento." },
      { label: "Continuidad", basic: "Se rompe cuando cambia la persona encargada.", professional: "La operación sigue con respaldo." },
    ],
    faq: [
      { question: "¿Se puede usar para cuotas mensuales y también para eventos?", answer: "Sí. Kurso está pensado para acompañar la operación normal del curso y también actividades puntuales que generan cobros o gastos adicionales." },
      { question: "¿Sirve si el curso aún usa transferencias y no pagos integrados?", answer: "Sí. Puedes ordenar el flujo actual del curso aunque no estés operando con integraciones avanzadas." },
      { question: "¿Ayuda en reuniones de apoderados?", answer: "Sí. Una de sus ventajas es llegar a la reunión con cifras, historial y contexto más claros para rendir cuentas sin improvisar." },
    ],
    relatedLinks: [
      { title: "Gastos e ingresos del curso", path: "/gastos-e-ingresos-curso" },
      { title: "Alternativa a Excel para cuotas", path: "/alternativa-a-excel-para-cuotas" },
      { title: "Cómo rendir gastos a apoderados", path: "/como-rendir-gastos-de-curso-a-apoderados" },
    ],
    ctaTitle: "Haz que la gestión financiera del curso se vea seria desde el primer mes",
    ctaBody: "Empieza a organizar cuotas, ingresos y rendiciones con un sistema que reduzca fricción para la directiva.",
    ctaLabel: "Crear cuenta",
  },
  "control-cuotas-curso": {
    id: "control-cuotas-curso",
    path: "/control-cuotas-curso",
    title: "Control de cuotas del curso sin perseguir pagos uno por uno",
    metaTitle: "Control de Cuotas de Curso Escolar | Pagos y deuda por alumno | Kurso",
    metaDescription: "Controla cuotas del curso escolar por alumno, detecta deuda pendiente y reduce el trabajo manual del tesorero con una plataforma clara para apoderados.",
    subtitle: "Ordena cuotas mensuales, pagos parciales y deuda pendiente con un sistema más claro para tesoreros y apoderados.",
    icon: "wallet",
    colorClass: "bg-emerald-500/10 text-emerald-500",
    introHeading: "El problema de las cuotas no es cobrarlas: es seguirlas bien",
    introParagraphs: [
      "Muchos cursos saben cuánto deberían recaudar, pero no siempre saben cuánto falta, quién está atrasado o qué pagos ya se registraron correctamente. Ahí empieza el desgaste de la directiva.",
      "Kurso te ayuda a controlar cuotas del curso con visibilidad por alumno y una trazabilidad más clara para evitar errores, dobles registros y conversaciones incómodas innecesarias.",
    ],
    features: [
      { title: "Vista de deuda pendiente", description: "Sabrás qué falta por cobrar sin reconstruir la información manualmente.", icon: "wallet" },
      { title: "Seguimiento menos invasivo", description: "Reduce el desgaste de perseguir pagos desde chats personales.", icon: "bell" },
      { title: "Información ordenada por alumno", description: "Cada pago y cuota queda asociada al historial correspondiente.", icon: "users" },
    ],
    bulletPoints: [
      "Cuotas mensuales más fáciles de seguir.",
      "Menos riesgo de olvidar pagos o registrar mal una transferencia.",
      "Menos presión interpersonal en la cobranza.",
      "Más claridad para saber cuánto se puede gastar de verdad.",
    ],
    comparisonHeading: "Controlar cuotas no debería depender del tesorero como memoria externa",
    comparisonRows: [
      { label: "Registro de pagos", basic: "Planilla o libreta actualizada a mano.", professional: "Historial por alumno dentro del sistema." },
      { label: "Seguimiento de mora", basic: "Mensajes manuales y poco consistentes.", professional: "Mayor claridad para seguimiento y cobranza." },
      { label: "Estado real del curso", basic: "Difícil de estimar en tiempo real.", professional: "Más fácil de revisar y compartir." },
      { label: "Errores administrativos", basic: "Fáciles de cometer y difíciles de auditar.", professional: "Menos dispersión y más trazabilidad." },
    ],
    faq: [
      { question: "¿Kurso permite saber quién debe cuotas?", answer: "Sí. La idea es que el tesorero pueda revisar el estado de pagos y deuda del curso sin reconstruirlo a mano cada semana." },
      { question: "¿Los apoderados pueden revisar su propio estado?", answer: "Sí. Kurso está pensado para que haya más transparencia y menos dependencia de mensajes privados para informar pagos." },
      { question: "¿Sirve aunque el curso tenga pocos alumnos?", answer: "Sí. De hecho, el beneficio aparece rápido porque incluso en cursos pequeños el seguimiento manual consume mucho tiempo." },
    ],
    relatedLinks: [
      { title: "Pagos de apoderados", path: "/pagos-apoderados" },
      { title: "Tesorería escolar", path: "/tesoreria-escolar" },
      { title: "Cómo cobrar cuotas sin WhatsApp", path: "/como-cobrar-cuotas-de-curso-sin-whatsapp" },
    ],
    ctaTitle: "Controla cuotas sin convertirte en cobrador del frac del curso",
    ctaBody: "Centraliza pagos y deuda pendiente con una experiencia más clara para ti y para los apoderados.",
    ctaLabel: "Ordenar mis cuotas",
  },
  "pagos-apoderados": {
    id: "pagos-apoderados",
    path: "/pagos-apoderados",
    title: "Pagos de apoderados con más claridad y menos fricción",
    metaTitle: "Pagos de Apoderados | Seguimiento y transparencia para cursos | Kurso",
    metaDescription: "Facilita el seguimiento de pagos de apoderados y mejora la transparencia del curso con un sistema que reduce la carga manual del tesorero.",
    subtitle: "Un sistema pensado para que los pagos de apoderados dejen de depender de chats, comprobantes perdidos y memoria.",
    icon: "users",
    colorClass: "bg-violet-500/10 text-violet-500",
    introHeading: "Los pagos de apoderados se desordenan rápido cuando no existe un lugar único para seguirlos",
    introParagraphs: [
      "Cada apoderado paga distinto, en fechas distintas y por motivos distintos. Cuando toda esa información se mueve entre transferencias, pantallazos y mensajes privados, el orden se vuelve frágil.",
      "Kurso centraliza el seguimiento de pagos de apoderados y entrega una experiencia más transparente para que la relación entre familias y directiva sea menos tensa y mucho más clara.",
    ],
    features: [
      { title: "Estado claro para cada familia", description: "Los apoderados pueden entender mejor cuánto han pagado y qué sigue pendiente.", icon: "users" },
      { title: "Menos mensajes repetidos", description: "La directiva deja de responder una y otra vez las mismas dudas básicas.", icon: "bell" },
      { title: "Más transparencia", description: "La confianza mejora cuando la información deja de estar dispersa.", icon: "shield" },
    ],
    bulletPoints: [
      "Evita depender del chat general para aclarar pagos.",
      "Reduce errores al identificar transferencias.",
      "Mejora la relación entre tesorero y apoderados.",
      "Permite informar sin exponer ni improvisar.",
    ],
    comparisonHeading: "Qué esperan hoy los apoderados de una tesorería ordenada",
    comparisonRows: [
      { label: "Información del pago", basic: "Se confirma por mensaje o captura.", professional: "Se consulta desde una vista clara del curso." },
      { label: "Confianza", basic: "Depende de la buena voluntad de quien administra.", professional: "Se apoya en información visible y consistente." },
      { label: "Resolución de dudas", basic: "Manual, repetitiva y desgastante.", professional: "Más simple porque el estado está más ordenado." },
      { label: "Seguimiento", basic: "Difuso cuando hay pagos parciales o atrasados.", professional: "Más fácil de revisar caso a caso." },
    ],
    faq: [
      { question: "¿Kurso reemplaza completamente la comunicación con apoderados?", answer: "No. La mejora principal es que la información básica está más disponible, por lo que la comunicación se vuelve más simple y menos repetitiva." },
      { question: "¿Sirve para cursos con actividades extraordinarias?", answer: "Sí. Además de las cuotas, también ayuda a ordenar cobros que nacen de paseos, rifas, eventos o materiales." },
      { question: "¿Esto reduce conflictos?", answer: "Ayuda bastante, porque una gran parte del conflicto nace de la desinformación o del retraso al rendir cuentas." },
    ],
    relatedLinks: [
      { title: "Control de cuotas del curso", path: "/control-cuotas-curso" },
      { title: "Gestión financiera de cursos", path: "/gestion-financiera-cursos-escolares" },
      { title: "Errores comunes del tesorero", path: "/errores-comunes-del-tesorero-de-curso" },
    ],
    ctaTitle: "Haz que los pagos de apoderados dejen de ser un foco de desgaste",
    ctaBody: "Da más claridad a las familias y menos carga manual a la directiva con un flujo más ordenado.",
    ctaLabel: "Ver cómo funciona",
  },
  "gastos-e-ingresos-curso": {
    id: "gastos-e-ingresos-curso",
    path: "/gastos-e-ingresos-curso",
    title: "Gastos e ingresos del curso con trazabilidad y respaldo",
    metaTitle: "Gastos e Ingresos del Curso | Rendición clara para apoderados | Kurso",
    metaDescription: "Centraliza los gastos e ingresos del curso, adjunta respaldos y rinde cuentas con más claridad para apoderados y directivas escolares.",
    subtitle: "Organiza gastos, ingresos y respaldos en una sola plataforma para rendir cuentas sin improvisar antes de cada reunión.",
    icon: "chart",
    colorClass: "bg-amber-500/10 text-amber-500",
    introHeading: "La rendición no debería empezar el día anterior a la reunión",
    introParagraphs: [
      "Cuando los gastos del curso se registran tarde o se guardan en carpetas y chats distintos, la rendición se vuelve una tarea estresante. Lo mismo pasa con ingresos extraordinarios y aportes parciales.",
      "Kurso reúne gastos e ingresos del curso con contexto y respaldo para que la directiva pueda mostrar cifras claras sin tener que reconstruir el historial a última hora.",
    ],
    features: [
      { title: "Respaldo de gastos", description: "Registra comprobantes y contexto del gasto donde corresponde.", icon: "shield" },
      { title: "Caja más clara", description: "Entiende mejor cuánto entró, cuánto salió y cuánto queda disponible.", icon: "chart" },
      { title: "Rendición más defendible", description: "Llegarás a las reuniones con menos incertidumbre y más evidencia.", icon: "check" },
    ],
    bulletPoints: [
      "Evita rendiciones apuradas o poco claras.",
      "Reduce el riesgo de perder boletas y comprobantes.",
      "Da más contexto a cada gasto relevante.",
      "Facilita explicar el balance a apoderados.",
    ],
    comparisonHeading: "Dejar rastros ordenados es lo que vuelve creíble la rendición",
    comparisonRows: [
      { label: "Boletas y respaldos", basic: "Guardados en carpetas o chats distintos.", professional: "Asociados al movimiento correspondiente." },
      { label: "Caja del curso", basic: "Se estima con cruces manuales.", professional: "Se revisa desde una sola vista." },
      { label: "Ingresos extra", basic: "Difíciles de separar de las cuotas normales.", professional: "Se pueden seguir con más orden." },
      { label: "Preparación de reuniones", basic: "Consume tiempo y energía cada mes.", professional: "Parte del trabajo ya está hecho." },
    ],
    faq: [
      { question: "¿Puedo registrar ingresos que no son cuotas mensuales?", answer: "Sí. La idea es que no todo quede mezclado en una sola categoría, sino con una estructura más clara para el curso." },
      { question: "¿Sirve para rendir gastos a apoderados?", answer: "Sí. De hecho, uno de los objetivos principales es facilitar esa rendición con contexto y respaldo." },
      { question: "¿Se pueden adjuntar comprobantes?", answer: "Sí, Kurso contempla el respaldo de gastos para que el historial sea más fácil de revisar." },
    ],
    relatedLinks: [
      { title: "Tesorería escolar", path: "/tesoreria-escolar" },
      { title: "Planilla vs software", path: "/planilla-vs-software-para-tesoreria-escolar" },
      { title: "Cómo rendir gastos", path: "/como-rendir-gastos-de-curso-a-apoderados" },
    ],
    ctaTitle: "Rinde cuentas con más respaldo y menos improvisación",
    ctaBody: "Organiza ingresos, gastos y comprobantes para que el balance del curso sea entendible y confiable.",
    ctaLabel: "Centralizar movimientos",
  },
  "software-tesorero-de-curso": {
    id: "software-tesorero-de-curso",
    path: "/software-tesorero-de-curso",
    title: "Software para tesorero de curso: menos caos, más seguimiento real",
    metaTitle: "Software para Tesorero de Curso | App para cuotas y gastos | Kurso",
    metaDescription: "Kurso es un software para tesorero de curso que ayuda a controlar cuotas, gastos, ingresos y pagos de apoderados desde un solo lugar.",
    subtitle: "Una app para tesoreros de curso que quieren ordenar pagos, rendir cuentas mejor y reducir la dependencia de Excel y WhatsApp.",
    icon: "shield",
    colorClass: "bg-rose-500/10 text-rose-500",
    introHeading: "Ser tesorero de curso no debería sentirse como un segundo trabajo",
    introParagraphs: [
      "El rol de tesorero suele venir con responsabilidades que nadie le enseña a administrar: cobrar, anotar, justificar, recordar, rendir y responder preguntas una y otra vez.",
      "Kurso funciona como software para tesorero de curso y reúne en una sola herramienta lo que antes quedaba repartido entre planillas, pantallazos y mensajes privados.",
    ],
    features: [
      { title: "Todo en un solo lugar", description: "Pagos, deuda, gastos e ingresos dejan de vivir en herramientas distintas.", icon: "wallet" },
      { title: "Menos dependencia del tesorero", description: "La información queda más disponible para la comunidad.", icon: "users" },
      { title: "Mayor respaldo", description: "Un software ordenado transmite más seriedad que una operación improvisada.", icon: "shield" },
    ],
    bulletPoints: [
      "Ideal para cursos que ya se cansaron del Excel eterno.",
      "Útil para directivas que quieren rendir cuentas sin conflictos.",
      "Pensado para operar desde celular y con apoderados reales, no usuarios ideales.",
      "Ayuda a profesionalizar un rol que suele ser informal.",
    ],
    comparisonHeading: "Qué cambia cuando el tesorero usa software y no una mezcla de herramientas",
    comparisonRows: [
      { label: "Carga operativa", basic: "Alta y repetitiva.", professional: "Más centralizada y ordenada." },
      { label: "Cobranza", basic: "Manual y difícil de seguir.", professional: "Mejor seguimiento y más contexto." },
      { label: "Rendición", basic: "Reactiva.", professional: "Más preparada de forma continua." },
      { label: "Confianza", basic: "Depende de la paciencia del curso.", professional: "Se apoya en mejor visibilidad." },
    ],
    faq: [
      { question: "¿Kurso es una app para usar desde el celular?", answer: "Sí. Está pensada para acompañar el trabajo real de una directiva que necesita revisar y registrar movimientos en cualquier momento." },
      { question: "¿Sirve si el curso aún es pequeño?", answer: "Sí. Incluso cursos pequeños sufren cuando el seguimiento financiero depende de memoria y herramientas sueltas." },
      { question: "¿Qué problema resuelve mejor?", answer: "Principalmente el desorden operativo: saber qué se pagó, cuánto se debe, qué se gastó y cómo explicarlo sin perder horas cada semana." },
    ],
    relatedLinks: [
      { title: "Tesorería escolar", path: "/tesoreria-escolar" },
      { title: "Control de cuotas", path: "/control-cuotas-curso" },
      { title: "Errores del tesorero de curso", path: "/errores-comunes-del-tesorero-de-curso" },
    ],
    ctaTitle: "Pasa de improvisar a operar con un sistema real",
    ctaBody: "Usa una herramienta diseñada para el trabajo del tesorero, no una planilla que se vuelve inmanejable.",
    ctaLabel: "Probar la app",
  },
  "tesoreria-escolar-gratis-vs-profesional": {
    id: "tesoreria-escolar-gratis-vs-profesional",
    path: "/tesoreria-escolar-gratis-vs-profesional",
    title: "Tesorería escolar gratis vs profesional: cuándo vale la pena dar el siguiente paso",
    metaTitle: "Tesorería Escolar Gratis vs Profesional | Comparativa para cursos | Kurso",
    metaDescription: "Compara una herramienta de tesorería escolar gratis con una solución profesional. Descubre cuándo conviene pasar a un sistema más serio y ordenado.",
    subtitle: "Lo gratis puede servir para empezar. Una solución profesional sirve cuando quieres continuidad, mejor operación y menos dependencia de una sola persona.",
    icon: "shield",
    colorClass: "bg-indigo-500/10 text-indigo-500",
    introHeading: "Gratis no siempre significa malo, pero tampoco significa suficiente",
    introParagraphs: [
      "Una herramienta gratis puede ser una buena forma de empezar. El problema aparece cuando el curso necesita más orden, menos fricción y una operación que siga funcionando aunque cambien las personas encargadas.",
      "Esta comparativa no se trata de atacar a nadie. Se trata de entender cuándo una solución gratuita alcanza y cuándo una herramienta profesional empieza a generar más valor que costo.",
    ],
    features: [
      { title: "Más continuidad", description: "La operación no debería quedar en pausa si alguien deja el cargo.", icon: "shield" },
      { title: "Menos trabajo invisible", description: "El costo real de lo gratis muchas veces está en el tiempo de la directiva.", icon: "check" },
      { title: "Mayor seriedad frente a apoderados", description: "La percepción cambia cuando la gestión se ve respaldada y ordenada.", icon: "users" },
    ],
    bulletPoints: [
      "Gratis sirve para probar o arrancar rápido.",
      "Profesional sirve para sostener el orden en el tiempo.",
      "La diferencia real está en la operación, no solo en la lista de funciones.",
      "El criterio no debe ser solo precio, sino tiempo, confianza y continuidad.",
    ],
    comparisonHeading: "Comparativa práctica: gratis para partir, profesional para escalar",
    comparisonRows: [
      { label: "Costo monetario", basic: "Menor o nulo al inicio.", professional: "Pago mensual, pero con más estructura y soporte." },
      { label: "Costo operativo", basic: "Puede recaer mucho en la directiva.", professional: "Reduce trabajo manual y desorden." },
      { label: "Soporte y continuidad", basic: "Puede ser más incierto según el proyecto.", professional: "Se espera una operación más consistente." },
      { label: "Percepción de seriedad", basic: "Depende mucho del esfuerzo del tesorero.", professional: "Se apoya en una herramienta más sólida." },
    ],
    faq: [
      { question: "¿Siempre conviene pagar por una solución profesional?", answer: "No necesariamente. Si el curso recién empieza o tiene una operación mínima, una opción gratuita puede alcanzar. El punto es detectar cuándo el costo invisible empieza a ser demasiado alto." },
      { question: "¿Cuál es ese costo invisible?", answer: "Horas de seguimiento manual, estrés de la directiva, errores administrativos y desgaste al rendir cuentas o cobrar atrasos." },
      { question: "¿Cómo saber si ya es momento de cambiar?", answer: "Si el tesorero siente que la operación depende demasiado de su tiempo, su memoria o sus mensajes privados, probablemente ya llegó ese momento." },
    ],
    relatedLinks: [
      { title: "Alternativa a Excel para cuotas", path: "/alternativa-a-excel-para-cuotas" },
      { title: "Alternativa a TesoreroEscolar", path: "/alternativa-a-tesoreroescolar" },
      { title: "Software para tesorero de curso", path: "/software-tesorero-de-curso" },
    ],
    ctaTitle: "No elijas solo por precio: elige por lo que te ahorra de verdad",
    ctaBody: "Si la tesorería ya te consume tiempo, energía y credibilidad, una solución profesional empieza a pagarse sola.",
    ctaLabel: "Comparar con Kurso",
  },
  "alternativa-a-excel-para-cuotas": {
    id: "alternativa-a-excel-para-cuotas",
    path: "/alternativa-a-excel-para-cuotas",
    title: "Alternativa a Excel para cuotas del curso",
    metaTitle: "Alternativa a Excel para Cuotas del Curso | Kurso Chile",
    metaDescription: "Descubre una alternativa a Excel para administrar cuotas del curso, pagos de apoderados y rendiciones de gastos con menos errores y más claridad.",
    subtitle: "Excel puede servir para empezar, pero se vuelve frágil cuando el curso necesita seguimiento real, historial y transparencia para apoderados.",
    icon: "wallet",
    colorClass: "bg-green-500/10 text-green-500",
    introHeading: "Excel no falla por ser malo: falla cuando le pides más de lo que puede dar",
    introParagraphs: [
      "La mayoría de los cursos parte administrando cuotas en una planilla. Es lógico: es rápido y parece suficiente. El problema llega cuando empiezan los pagos parciales, los gastos con respaldo, los cambios de directiva y las dudas de los apoderados.",
      "Kurso es una alternativa a Excel para cuotas del curso porque agrega seguimiento, visibilidad y continuidad donde una planilla empieza a quedarse corta.",
    ],
    features: [
      { title: "Menos errores manuales", description: "Reduce el riesgo de editar mal, sobrescribir o perder información importante.", icon: "check" },
      { title: "Información menos dispersa", description: "La planilla deja de ser el centro y el curso gana una fuente más clara de verdad.", icon: "chart" },
      { title: "Más transparencia", description: "La información no tiene por qué vivir solo en el computador del tesorero.", icon: "users" },
    ],
    bulletPoints: [
      "Ideal para cursos que ya sienten que la planilla no alcanza.",
      "Menos riesgo de trabajar con versiones distintas del archivo.",
      "Más facilidad para rendir cuentas y revisar deuda.",
      "Mejor experiencia para tesorero y apoderados.",
    ],
    comparisonHeading: "Excel vs una plataforma especializada para cuotas",
    comparisonRows: [
      { label: "Edición y errores", basic: "Alta dependencia del manejo manual.", professional: "Más estructura y menos exposición a errores triviales." },
      { label: "Estado de pagos", basic: "Se calcula y revisa a mano.", professional: "Se sigue con más facilidad por alumno." },
      { label: "Transparencia", basic: "Depende de compartir capturas o archivos.", professional: "Se apoya en una experiencia más clara." },
      { label: "Continuidad", basic: "La información puede quedar atrapada en una persona.", professional: "Permite sostener el historial del curso." },
    ],
    faq: [
      { question: "¿Kurso reemplaza por completo la planilla?", answer: "Esa es la idea en la operación diaria del curso. Así evitas depender del archivo para controlar pagos y rendir cuentas." },
      { question: "¿Excel sigue sirviendo para algo?", answer: "Sí, puede seguir siendo útil en ciertos análisis o respaldos, pero no es la mejor base para operar cuotas y seguimiento todos los meses." },
      { question: "¿Vale la pena cambiar si ya tengo una planilla hecha?", answer: "Si esa planilla ya te consume demasiado tiempo o genera fricción con apoderados, probablemente sí." },
    ],
    relatedLinks: [
      { title: "Control de cuotas del curso", path: "/control-cuotas-curso" },
      { title: "Gratis vs profesional", path: "/tesoreria-escolar-gratis-vs-profesional" },
      { title: "Planilla vs software", path: "/planilla-vs-software-para-tesoreria-escolar" },
    ],
    ctaTitle: "Da el salto cuando Excel empieza a costarte tiempo y credibilidad",
    ctaBody: "Pasa a una plataforma más clara para cuotas, deuda y rendiciones sin seguir acumulando trabajo manual.",
    ctaLabel: "Ver alternativa",
  },
  "alternativa-a-tesoreroescolar": {
    id: "alternativa-a-tesoreroescolar",
    path: "/alternativa-a-tesoreroescolar",
    title: "Alternativa a TesoreroEscolar: más control operativo para cursos y directivas",
    metaTitle: "Alternativa a TesoreroEscolar | Kurso para cursos y apoderados",
    metaDescription: "Si buscas una alternativa a TesoreroEscolar, compara enfoque, operación y claridad para tesorería de cursos, pagos de apoderados y rendiciones.",
    subtitle: "Si estás evaluando opciones para ordenar la tesorería del curso, esta comparativa te ayuda a entender qué buscar más allá del precio o la promesa de transparencia.",
    icon: "chart",
    colorClass: "bg-cyan-500/10 text-cyan-500",
    introHeading: "Comparar herramientas de tesorería escolar exige mirar la operación, no solo la landing",
    introParagraphs: [
      "Al evaluar una alternativa a TesoreroEscolar, conviene mirar qué tan bien la herramienta acompaña el día a día del tesorero: seguimiento de cuotas, rendición de gastos, comunicación con apoderados y continuidad de la directiva.",
      "Kurso apunta a resolver ese trabajo completo con un enfoque de control operativo, transparencia y menos trabajo manual, sin basarse en afirmaciones no comprobables sobre terceros.",
    ],
    features: [
      { title: "Menos fricción en cobranza", description: "Un buen sistema debe ayudarte a seguir pagos sin desgastar al tesorero.", icon: "bell" },
      { title: "Rendición más clara", description: "No basta con mostrar números; hay que poder explicar y sostener el historial.", icon: "chart" },
      { title: "Operación más seria", description: "Soporte, continuidad y orden pesan tanto como la lista de funciones.", icon: "shield" },
    ],
    bulletPoints: [
      "Compara por claridad operativa, no solo por precio.",
      "Busca una herramienta que reduzca trabajo invisible.",
      "La confianza de apoderados depende del orden sostenido.",
      "La mejor alternativa es la que soporta mejor la realidad del curso.",
    ],
    comparisonHeading: "Qué comparar cuando buscas una alternativa real",
    comparisonRows: [
      { label: "Transparencia", basic: "Mostrar balances puede ser suficiente al inicio.", professional: "La transparencia mejora cuando el seguimiento también es fuerte." },
      { label: "Cobranza", basic: "Puede seguir dependiendo mucho de la directiva.", professional: "Se espera menos trabajo manual y más contexto." },
      { label: "Rendición", basic: "Útil si la información está ordenada a tiempo.", professional: "Más sólida cuando hay trazabilidad continua." },
      { label: "Decisión final", basic: "Elegir por precio inicial.", professional: "Elegir por costo total de operación y confianza." },
    ],
    faq: [
      { question: "¿Kurso busca reemplazar a cualquier opción gratuita?", answer: "Kurso apunta a ser una alternativa para cursos y directivas que necesitan más control, continuidad y menor carga manual en la operación diaria." },
      { question: "¿En qué fijarse al comparar?", answer: "En soporte, claridad de la experiencia, facilidad para rendir cuentas, seguimiento de pagos y continuidad cuando cambian los responsables." },
      { question: "¿Puedo empezar por una comparativa antes de contratar?", answer: "Sí. La idea de esta página es justamente ayudarte a comparar con criterios útiles antes de tomar una decisión." },
    ],
    relatedLinks: [
      { title: "Tesorería escolar gratis vs profesional", path: "/tesoreria-escolar-gratis-vs-profesional" },
      { title: "Software para tesorero de curso", path: "/software-tesorero-de-curso" },
      { title: "Gestión financiera para cursos", path: "/gestion-financiera-cursos-escolares" },
    ],
    ctaTitle: "Compara con criterios más serios que solo “es gratis”",
    ctaBody: "Si quieres una operación más ordenada, evalúa Kurso por control, claridad y continuidad.",
    ctaLabel: "Evaluar Kurso",
  },
};
