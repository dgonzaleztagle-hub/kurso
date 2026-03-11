export interface BlogPost {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    content: string;
    date: string;
    author: string;
    category: string;
    image: string;
    tags: string[];
}

export const BLOG_POSTS: BlogPost[] = [
    {
        id: "1",
        slug: "guia-tesorero-curso-chile-paso-a-paso",
        title: "Guía Definitiva: Cómo ser el mejor tesorero de curso en Chile (Sin morir en el intento)",
        excerpt: "Ser tesorero es una responsabilidad enorme. Aquí te enseñamos a organizar las finanzas, cobrar cuotas y rendir cuentas con total transparencia.",
        content: `
# Cómo ser el mejor tesorero de curso en Chile

Aceptar el cargo de **tesorero de curso** es, para muchos, un acto de valentía. Implica manejar dinero ajeno, lidiar con la morosidad y, sobre todo, mantener la armonía en un grupo de WhatsApp que nunca duerme.

En esta guía, te entregamos las herramientas y consejos para que tu gestión sea impecable, transparente y, sobre todo, profesional.

## 1. La Transparencia es tu mejor amiga
El mayor problema en las directivas de curso no es la falta de dinero, sino la **falta de información**. Si los apoderados no saben en qué se gasta su aporte, empezarán las dudas.

*   **Paso 1:** Define una cuota clara y justificada.
*   **Paso 2:** Registra cada ingreso el mismo día que lo recibes.
*   **Paso 3:** No mezcles tu dinero personal con el del curso.

## 2. Abandona el Excel (Si puedes)
Aunque las planillas de Excel han sido el estándar por años, son riesgosas. Se pueden borrar, no se actualizan en tiempo real para todos y requieren mucho trabajo manual.

Herramientas como **Kurso** permiten que:
1.  Los padres vean su estado de cuenta en tiempo real.
2.  Tú registres ingresos en segundos desde tu celular.
3.  El sistema rinda cuentas por ti de forma automática.

## 3. Manejo de Morosidad con Empatía
Recordar los pagos es la parte más incómoda. En lugar de cobrar "persona por persona" en el chat general, utiliza notificaciones automáticas. Esto profesionaliza el proceso y reduce el estrés interpersonal.

## Conclusión
Un buen tesorero no es el que más cobra, sino el que mejor informa. Con transparencia y las herramientas digitales adecuadas, puedes transformar una tarea tediosa en un servicio valioso para tu comunidad escolar.

---
*Escrito por el Equipo Editorial de Kurso.app*
        `,
        date: "2026-03-10",
        author: "Héctor de HojaCero",
        category: "Gestión Escolar",
        image: "https://images.unsplash.com/photo-1454165833767-027ffea70288?q=80&w=2070&auto=format&fit=crop",
        tags: ["Tesorería", "Consejos", "Chile", "Colegios"]
    },
    {
        id: "2",
        slug: "transparencia-financiera-centros-padres-cepa",
        title: "Transparencia Financiera en Centros de Padres (CEPA): Por qué es vital en 2026",
        excerpt: "Las organizaciones escolares manejan presupuestos cada vez más grandes. Aprende cómo la tecnología digital está eliminando los conflictos en los colegios.",
        content: `
# Por qué la Transparencia Financiera es Vital en los Centros de Padres (CEPA)

Los Centros de Padres y Apoderados (CEPA) cumplen un rol fundamental en la educación chilena. Gestionan recursos para infraestructura, eventos y ayuda social. Sin embargo, la gestión "a la antigua" suele generar desconfianza.

## La Crisis de Confianza
Muchos conflictos escolares nacen de la percepción de una "caja negra" en las finanzas del CEPA. Cuando no hay claridad, surgen rumores de mal uso de fondos, incluso si la directiva está haciendo un trabajo honesto.

## Beneficios de la Digitalización
Implementar un sistema de gestión financiera (SaaS) como Kurso trae beneficios inmediatos:

1.  **Auditoría en Tiempo Real:** Los directivos pueden revisar el balance en cualquier momento.
2.  **Seguridad de Datos:** La información no se pierde si un directivo deja el cargo.
3.  **Participación:** Apoderados informados son apoderados que participan más.

## Hacia una Gestión Profesional
En 2026, ya no basta con un cuaderno de notas. El compromiso con la transparencia es un valor que diferencia a los colegios líderes.

---
*Escrito por el Equipo Editorial de Kurso.app*
        `,
        date: "2026-03-05",
        author: "Soluciones HojaCero",
        category: "Educación",
        image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=2011&auto=format&fit=crop",
        tags: ["CEPA", "Transparencia", "SaaS", "Gestión"]
    }
];
