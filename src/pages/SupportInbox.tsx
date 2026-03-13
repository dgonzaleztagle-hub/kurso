import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import {
  getSupportStatusLabel,
  getSupportTicket,
  getSupportVisibilityLabel,
  listSupportTickets,
  replySupportTicket,
  type SupportTicketDetail,
  type SupportTicketMessage,
  type SupportTicketSummary,
  type SupportStatus,
  updateSupportTicketStatus,
} from "@/lib/supportTickets";
import { resolveBranding } from "@/lib/branding";
import { toast } from "sonner";

const STATUS_FILTERS: Array<{ value: "all" | SupportStatus; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "open", label: "Abiertos" },
  { value: "waiting_superadmin", label: "Esperando superadmin" },
  { value: "waiting_course", label: "Esperando curso" },
  { value: "resolved", label: "Resueltos" },
];

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("es-CL") : "Sin fecha";

export default function SupportInbox() {
  const { appUser } = useAuth();
  const { currentTenant } = useTenant();
  const branding = resolveBranding(currentTenant?.settings, currentTenant?.name);
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<SupportTicketDetail | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | SupportStatus>("all");
  const [canReplyInApp, setCanReplyInApp] = useState(false);

  const filteredTickets = useMemo(() => (
    statusFilter === "all" ? tickets : tickets.filter((ticket) => ticket.status === statusFilter)
  ), [statusFilter, tickets]);

  const loadTickets = async (preferredTicketId?: string | null) => {
    setLoading(true);
    try {
      const nextTickets = await listSupportTickets();
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el ticket.");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadTickets();
  }, []);

  useEffect(() => {
    if (selectedTicketId) {
      void loadTicketDetail(selectedTicketId);
    } else {
      setTicketDetail(null);
      setMessages([]);
      setCanReplyInApp(false);
    }
  }, [selectedTicketId]);

  const handleReply = async () => {
    if (!ticketDetail || !replyBody.trim()) {
      toast.error("Escribe una respuesta antes de enviar.");
      return;
    }

    setSendingReply(true);
    try {
      await replySupportTicket(ticketDetail.id, replyBody);
      setReplyBody("");
      await loadTickets(ticketDetail.id);
      await loadTicketDetail(ticketDetail.id);
      toast.success("Respuesta enviada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo responder.");
    } finally {
      setSendingReply(false);
    }
  };

  const handleStatusUpdate = async (status: SupportStatus) => {
    if (!ticketDetail) return;

    setUpdatingStatus(true);
    try {
      await updateSupportTicketStatus(ticketDetail.id, status);
      await loadTickets(ticketDetail.id);
      await loadTicketDetail(ticketDetail.id);
      toast.success("Estado actualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el estado.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Inbox de Soporte | {branding.appName}</title>
      </Helmet>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Soporte interno</p>
          <h1 className="text-3xl font-bold tracking-tight">Respuestas de soporte</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Revisa conversaciones de soporte y responde dentro de la plataforma.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{appUser?.full_name || "Usuario"}</Badge>
          <Button asChild variant="outline">
            <Link to="/soporte">Crear nuevo ticket</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Button
            key={filter.value}
            variant={statusFilter === filter.value ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="p-0">
          <div className="border-b p-4">
            <h2 className="font-semibold">Tickets</h2>
            <p className="text-sm text-muted-foreground">
              {loading ? "Cargando..." : `${filteredTickets.length} visibles`}
            </p>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {filteredTickets.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No hay tickets para mostrar.</div>
            ) : (
              filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  className={`w-full border-b p-4 text-left transition-colors hover:bg-muted/40 ${
                    selectedTicketId === ticket.id ? "bg-muted/60" : ""
                  }`}
                  onClick={() => setSelectedTicketId(ticket.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{ticket.subject}</p>
                      <p className="text-sm text-muted-foreground">{ticket.tenant_name || "Sin tenant"}</p>
                    </div>
                    <Badge variant="outline">{getSupportStatusLabel(ticket.status)}</Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{ticket.name}</span>
                    <span>•</span>
                    <span>{getSupportVisibilityLabel(ticket.visibility_mode)}</span>
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
              Selecciona un ticket para ver el detalle.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-semibold">{ticketDetail.subject}</h2>
                    <Badge>{getSupportStatusLabel(ticketDetail.status)}</Badge>
                    <Badge variant="outline">{ticketDetail.request_type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {ticketDetail.name} · {ticketDetail.email}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tenant: {ticketDetail.tenant_name || "Sin tenant"} · Canal: {getSupportVisibilityLabel(ticketDetail.visibility_mode)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Creado: {formatDate(ticketDetail.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={updatingStatus || ticketDetail.status === "open"}
                    onClick={() => void handleStatusUpdate("open")}
                  >
                    Reabrir
                  </Button>
                  <Button
                    disabled={updatingStatus || ticketDetail.status === "resolved"}
                    onClick={() => void handleStatusUpdate("resolved")}
                  >
                    Marcar resuelto
                  </Button>
                </div>
              </div>

              {detailLoading ? (
                <div className="text-sm text-muted-foreground">Cargando detalle...</div>
              ) : (
                <>
                  <div className="space-y-3">
                    <h3 className="font-semibold">Conversacion</h3>
                    {messages.length === 0 ? (
                      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                        {ticketDetail.message || "Este ticket no tiene hilo interno."}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {messages.map((message) => (
                          <div key={message.id} className="rounded-xl border p-4">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge variant={message.author_role === "superadmin" ? "default" : "secondary"}>
                                  {message.author_role}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">{formatDate(message.created_at)}</span>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {canReplyInApp ? (
                    <div className="space-y-3 border-t pt-4">
                      <h3 className="font-semibold">Responder</h3>
                      <Textarea
                        value={replyBody}
                        onChange={(event) => setReplyBody(event.target.value)}
                        rows={6}
                        placeholder="Escribe una respuesta clara y accionable."
                      />
                      <div className="flex justify-end">
                        <Button disabled={sendingReply || !replyBody.trim()} onClick={() => void handleReply()}>
                          {sendingReply ? "Enviando..." : "Enviar respuesta"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      Este ticket no admite respuesta dentro de la app.
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
