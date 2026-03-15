import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const TRACKED_EXACT_PATHS = new Set([
  "/",
  "/blog",
  "/privacidad",
  "/privacy-choices",
  "/soporte",
  "/servicios/tesoreria-de-curso",
  "/servicios/gestion-centros-de-padres",
  "/casos/transparencia-total-colegio-chile",
  "/tesoreria-escolar",
  "/gestion-financiera-cursos-escolares",
  "/control-cuotas-curso",
  "/pagos-apoderados",
  "/gastos-e-ingresos-curso",
  "/software-tesorero-de-curso",
  "/tesoreria-escolar-gratis-vs-profesional",
  "/alternativa-a-excel-para-cuotas",
  "/alternativa-a-tesoreroescolar",
  "/como-llevar-la-tesoreria-de-un-curso",
  "/como-cobrar-cuotas-de-curso-sin-whatsapp",
  "/como-rendir-gastos-de-curso-a-apoderados",
  "/errores-comunes-del-tesorero-de-curso",
  "/planilla-vs-software-para-tesoreria-escolar",
]);

const TRACKED_PREFIXES = ["/blog/"];

function getOrCreateStorageKey(key: string) {
  const storage = key === "kurso_page_visit_session_id" ? window.sessionStorage : window.localStorage;
  const existing = storage.getItem(key);
  if (existing) {
    return existing;
  }

  const generated = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  storage.setItem(key, generated);
  return generated;
}

function shouldTrackPath(pathname: string) {
  if (TRACKED_EXACT_PATHS.has(pathname)) {
    return true;
  }

  return TRACKED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function PublicPageTracker() {
  const location = useLocation();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldTrackPath(location.pathname)) {
      return;
    }

    const dedupeKey = `${location.pathname}${location.search}`;
    if (lastTrackedPath.current === dedupeKey) {
      return;
    }
    lastTrackedPath.current = dedupeKey;

    const visitorId = getOrCreateStorageKey("kurso_page_visit_visitor_id");
    const sessionId = getOrCreateStorageKey("kurso_page_visit_session_id");
    const params = new URLSearchParams(location.search);

    void (supabase as any).from("page_visit_events").insert({
      path: location.pathname,
      title: document.title || null,
      referrer: document.referrer || null,
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      visitor_id: visitorId,
      session_id: sessionId,
    });
  }, [location.pathname, location.search]);

  return null;
}
