import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getSupportStatusLabel,
  getSupportTicket,
  getSupportVisibilityLabel,
  listSupportTickets,
  replySupportTicket,
  type SupportStatus,
  type SupportTicketDetail,
  type SupportTicketMessage,
  type SupportTicketSummary,
  updateSupportTicketStatus,
} from "@/lib/supportTickets";
import { toast } from "sonner";

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("es-CL") : "Sin fecha";

export default function SupportTickets() {
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<SupportTicketDetail | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [externalReplyNote, setExternalReplyNote] = useState("");
  const [canReplyInApp, setCanReplyInApp] = useState(false);
  const [saving, setSaving] = useState(false);

  const tenantOptions = useMemo(() => {
    return [...new Map(
      tickets
        .filter((ticket) => ticket.tenant_id)
        .map((ticket) => [ticket.tenant_id as string, { id: ticket.tenant_id as string, name: ticket.tenant_name || "Sin tenant" }]),
    ).values()];
  }, [tickets]);

  const loadTickets = async (preferredTicketId?: string | null) => {
    setLoading(true);
    try {
      const nextTickets = await listSupportTickets({
        status: statusFilter === "all" ? undefined : statusFilter,
        visibilityMode: visibilityFilter === "all" ? undefined : visibilityFilter,
        tenantId: tenantFilter === "all" ? undefined : tenantFilter,
        search: search.trim() || undefined,
      });
      setTickets(nextTickets);

      const nextSelectedTicketId =
        preferredTicketId && nextTickets.some((ticket) => ticket.id === preferredTicketId)
          ? preferredTicketId
          : nextTickets[0]?.id ?? null;

      setSelectedTicketId(nextSelectedTicketId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar los tickets.");
    } finally {
      setLoading(false);
    }
  };

  const loadTicketDetail = async (ticketId: string) => {
    setDetailLoading(true);
    try {
      const response = await getSupportTicket(ticketId);
      setTicketDetail(response.ticket);
      setMessages(response.messages);
      setCanReplyInApp(response.canReplyInApp);
      setExternalReplyNote(response.ticket.external_reply_note || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el ticket.");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadTickets();
  }, [statusFilter, visibilityFilter, tenantFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadTickets(selectedTicketId);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (selectedTicketId) {
      void loadTicketDetail(selectedTicketId);
    } else {
      setTicketDetail(null);
      setMessages([]);
      setCanReplyInApp(false);
      setExternalReplyNote("");
    }
  }, [selectedTicketId]);

  const handleReply = async () => {
    if (!ticketDetail || !replyBody.trim()) {
      toast.error("Escribe una respuesta antes de enviar.");
      return;
    }

    setSaving(true);
    try {
      await replySupportTicket(ticketDetail.id, replyBody);
      setReplyBody("");
      await loadTickets(ticketDetail.id);
      await loadTicketDetail(ticketDetail.id);
      toast.success("Respuesta enviada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo responder.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (status: SupportStatus) => {
    if (!ticketDetail) return;

    setSaving(true);
    try {
      await updateSupportTicketStatus(ticketDetail.id, status, externalReplyNote || undefined);
      await loadTickets(ticketDetail.id);
      await loadTicketDetail(ticketDetail.id);
      toast.success("Estado actualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el estado.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Superadmin</p>
          <h1 className="text-3xl font-bold tracking-tight">Soporte</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Bandeja global de tickets internos y solicitudes publicas.
          </p>
        </div>
        <Badge variant="secondary">{tickets.length} tickets</Badge>
      </div>

      <Card className="grid gap-3 p-4 md:grid-cols-4">
        <Input
          placeholder="Buscar por asunto, tenant, correo..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">Todos los estados</option>
          <option value="open">Abierto</option>
          <option value="waiting_superadmin">Esperando superadmin</option>
          <option value="waiting_course">Esperando curso</option>
          <option value="resolved">Resuelto</option>
          <option value="closed">Cerrado</option>
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={visibilityFilter}
          onChange={(event) => setVisibilityFilter(event.target.value)}
        >
          <option value="all">Todos los modos</option>
          <option value="authenticated_thread">Interno</option>
          <option value="public_email_only">Publico</option>
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={tenantFilter}
          onChange={(event) => setTenantFilter(event.target.value)}
        >
          <option value="all">Todos los tenants</option>
          {tenantOptions.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))}
        </select>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        <Card className="p-0">
          <div className="border-b p-4">
            <h2 className="font-semibold">Listado</h2>
            <p className="text-sm text-muted-foreground">{loading ? "Cargando..." : `${tickets.length} resultados`}</p>
          </div>
          <div className="max-h-[72vh] overflow-y-auto">
            {tickets.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No se encontraron tickets.</div>
            ) : (
              tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  className={`w-full border-b p-4 text-left transition-colors hover:bg-muted/40 ${
                    selectedTicketId === ticket.id ? "bg-muted/60" : ""
                  }`}
                  onClick={() => setSelectedTicketId(ticket.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{ticket.subject}</p>
                      <p className="text-sm text-muted-foreground">{ticket.name} · {ticket.email}</p>
                    </div>
                    <Badge>{getSupportStatusLabel(ticket.status)}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{getSupportVisibilityLabel(ticket.visibility_mode)}</span>
                    <span>•</span>
                    <span>{ticket.tenant_name || "Sin tenant"}</span>
                    <span>•</span>
                    <span>{ticket.request_type}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Ultimo movimiento: {formatDate(ticket.last_message_at || ticket.created_at)}
                  </p>
                </button>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6">
          {!ticketDetail ? (
            <div className="flex min-h-[420px] items-center justify-center text-sm text-muted-foreground">
              Selecciona un ticket para revisar el detalle.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 border-b pb-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-semibold">{ticketDetail.subject}</h2>
                    <Badge>{getSupportStatusLabel(ticketDetail.status)}</Badge>
                    <Badge variant="outline">{getSupportVisibilityLabel(ticketDetail.visibility_mode)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {ticketDetail.name} · {ticketDetail.email}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tenant: {ticketDetail.tenant_name || "Sin tenant"} · Tipo: {ticketDetail.request_type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Creado {formatDate(ticketDetail.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={saving} onClick={() => void handleStatusUpdate("open")}>
                    Reabrir
                  </Button>
                  <Button variant="outline" disabled={saving} onClick={() => void handleStatusUpdate("closed")}>
                    Cerrar
                  </Button>
                  <Button disabled={saving} onClick={() => void handleStatusUpdate("resolved")}>
                    Resolver
                  </Button>
                </div>
              </div>

              {detailLoading ? (
                <div className="text-sm text-muted-foreground">Cargando detalle...</div>
              ) : (
                <>
                  <div className="space-y-3">
                    <h3 className="font-semibold">Historial</h3>
                    {ticketDetail.visibility_mode === "authenticated_thread" ? (
                      <div className="space-y-3">
                        {messages.map((message) => (
                          <div key={message.id} className="rounded-xl border p-4">
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant={message.author_role === "superadmin" ? "default" : "secondary"}>
                                {message.author_role}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{formatDate(message.created_at)}</span>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border p-4">
                        <p className="whitespace-pre-wrap text-sm leading-6">{ticketDetail.message}</p>
                      </div>
                    )}
                  </div>

                  {canReplyInApp ? (
                    <div className="space-y-3 border-t pt-4">
                      <h3 className="font-semibold">Responder dentro de la app</h3>
                      <Textarea
                        rows={6}
                        value={replyBody}
                        onChange={(event) => setReplyBody(event.target.value)}
                        placeholder="Escribe una respuesta para el hilo interno."
                      />
                      <div className="flex justify-end">
                        <Button disabled={saving || !replyBody.trim()} onClick={() => void handleReply()}>
                          {saving ? "Enviando..." : "Enviar respuesta"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 border-t pt-4">
                      <h3 className="font-semibold">Respuesta manual por correo</h3>
                      <p className="text-sm text-muted-foreground">
                        Este ticket es publico. Responde manualmente fuera del sistema y registra una nota para auditoria.
                      </p>
                      <Textarea
                        rows={5}
                        value={externalReplyNote}
                        onChange={(event) => setExternalReplyNote(event.target.value)}
                        placeholder="Ej: se respondio el 13/03 por correo con pasos de recuperacion."
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline">
                          <a href={`mailto:${ticketDetail.email}?subject=Re:%20${encodeURIComponent(ticketDetail.subject)}`}>
                            Responder por correo
                          </a>
                        </Button>
                        <Button disabled={saving} onClick={() => void handleStatusUpdate("resolved")}>
                          Guardar nota y resolver
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
