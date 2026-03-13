import { supabase } from "@/integrations/supabase/client";

export type SupportVisibilityMode = "authenticated_thread" | "public_email_only";
export type SupportStatus = "open" | "waiting_course" | "waiting_superadmin" | "resolved" | "closed";

export type SupportTicketSummary = {
  id: string;
  created_at: string;
  request_type: string;
  status: SupportStatus;
  subject: string;
  name: string;
  email: string;
  tenant_id: string | null;
  tenant_name: string | null;
  requester_user_id: string | null;
  requester_email_normalized: string | null;
  requester_role: string | null;
  assigned_owner_user_id: string | null;
  visibility_mode: SupportVisibilityMode;
  last_message_at: string | null;
  resolved_at: string | null;
  source: string;
  external_reply_note?: string | null;
  last_external_reply_at?: string | null;
};

export type SupportTicketDetail = SupportTicketSummary & {
  message?: string;
  resolved_by_user_id?: string | null;
};

export type SupportTicketMessage = {
  id: string;
  created_at: string;
  author_user_id: string | null;
  author_role: string;
  body: string;
};

type FunctionsError = { error?: string; message?: string };

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const candidate = error as FunctionsError;
    return candidate.error || candidate.message || "Ocurrió un error inesperado";
  }
  return "Ocurrió un error inesperado";
}

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function submitSupportTicket(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("submit-support-request", {
    body: payload,
    headers: await getAuthHeaders(),
  });

  if (error) throw new Error(getErrorMessage(error));
  const response = data as FunctionsError & {
    ticketId?: string;
    visibilityMode?: SupportVisibilityMode;
    status?: SupportStatus;
    followUpChannel?: "in_app" | "email_manual";
  };
  if (response?.error) throw new Error(response.error);
  return response;
}

export async function listSupportTickets(payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("list-support-tickets", {
    body: payload,
    headers: await getAuthHeaders(),
  });

  if (error) throw new Error(getErrorMessage(error));
  const response = data as FunctionsError & { tickets?: SupportTicketSummary[] };
  if (response?.error) throw new Error(response.error);
  return response.tickets ?? [];
}

export async function getSupportTicket(ticketId: string) {
  const { data, error } = await supabase.functions.invoke("get-support-ticket", {
    body: { ticketId },
    headers: await getAuthHeaders(),
  });

  if (error) throw new Error(getErrorMessage(error));
  const response = data as FunctionsError & {
    ticket?: SupportTicketDetail;
    messages?: SupportTicketMessage[];
    canReplyInApp?: boolean;
  };
  if (response?.error) throw new Error(response.error);
  if (!response.ticket) throw new Error("Ticket no encontrado");
  return {
    ticket: response.ticket,
    messages: response.messages ?? [],
    canReplyInApp: Boolean(response.canReplyInApp),
  };
}

export async function replySupportTicket(ticketId: string, body: string) {
  const { data, error } = await supabase.functions.invoke("reply-support-ticket", {
    body: { ticketId, body },
    headers: await getAuthHeaders(),
  });

  if (error) throw new Error(getErrorMessage(error));
  const response = data as FunctionsError & {
    status?: SupportStatus;
    message?: SupportTicketMessage;
  };
  if (response?.error) throw new Error(response.error);
  return response;
}

export async function updateSupportTicketStatus(
  ticketId: string,
  status: SupportStatus,
  externalReplyNote?: string,
) {
  const { data, error } = await supabase.functions.invoke("update-support-ticket-status", {
    body: { ticketId, status, externalReplyNote },
    headers: await getAuthHeaders(),
  });

  if (error) throw new Error(getErrorMessage(error));
  const response = data as FunctionsError & { status?: SupportStatus };
  if (response?.error) throw new Error(response.error);
  return response;
}

export function getSupportStatusLabel(status: SupportStatus) {
  switch (status) {
    case "open":
      return "Abierto";
    case "waiting_course":
      return "Esperando curso";
    case "waiting_superadmin":
      return "Esperando superadmin";
    case "resolved":
      return "Resuelto";
    case "closed":
      return "Cerrado";
    default:
      return status;
  }
}

export function getSupportVisibilityLabel(mode: SupportVisibilityMode) {
  return mode === "authenticated_thread" ? "Interno" : "Publico";
}
