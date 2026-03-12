export type ReimbursementAction = "approve" | "reject" | "reopen" | "delete";

export type ReimbursementProofFile = {
  name: string;
  path: string;
  uploaded_at?: string;
};

type ReimbursementActionPayload = {
  action?: unknown;
  reimbursementId?: unknown;
  rejectionReason?: unknown;
  paymentProof?: unknown;
};

export type ParsedReimbursementAction = {
  action: ReimbursementAction;
  reimbursementId: string;
  rejectionReason: string | null;
  paymentProof: ReimbursementProofFile[];
};

export function parseReimbursementActionPayload(
  payload: ReimbursementActionPayload,
): ParsedReimbursementAction {
  const action = String(payload.action ?? "").trim() as ReimbursementAction;
  const reimbursementId = String(payload.reimbursementId ?? "").trim();
  const rejectionReason = String(payload.rejectionReason ?? "").trim();
  const paymentProof = Array.isArray(payload.paymentProof)
    ? payload.paymentProof.filter(isProofFile)
    : [];

  if (!["approve", "reject", "reopen", "delete"].includes(action)) {
    throw new Error("Accion no soportada");
  }

  if (!reimbursementId) {
    throw new Error("reimbursementId es requerido");
  }

  if (action === "reject" && !rejectionReason) {
    throw new Error("Debe indicar el motivo del rechazo");
  }

  return {
    action,
    reimbursementId,
    rejectionReason: rejectionReason || null,
    paymentProof,
  };
}

function isProofFile(value: unknown): value is ReimbursementProofFile {
  if (!value || typeof value !== "object") return false;

  const file = value as Record<string, unknown>;
  return typeof file.name === "string" && typeof file.path === "string";
}
