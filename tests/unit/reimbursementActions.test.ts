import test from "node:test";
import assert from "node:assert/strict";

import { parseReimbursementActionPayload } from "../../supabase/functions/_shared/reimbursementActions.ts";

test("parseReimbursementActionPayload accepts approval proof metadata", () => {
  const parsed = parseReimbursementActionPayload({
    action: "approve",
    reimbursementId: "abc-123",
    paymentProof: [
      { name: "comprobante.pdf", path: "abc-123/proof.pdf", uploaded_at: "2026-03-12T00:00:00.000Z" },
      { name: "ignorar" },
    ],
  });

  assert.deepEqual(parsed, {
    action: "approve",
    reimbursementId: "abc-123",
    rejectionReason: null,
    paymentProof: [
      { name: "comprobante.pdf", path: "abc-123/proof.pdf", uploaded_at: "2026-03-12T00:00:00.000Z" },
    ],
  });
});

test("parseReimbursementActionPayload requires rejection reason for reject", () => {
  assert.throws(() => parseReimbursementActionPayload({
    action: "reject",
    reimbursementId: "abc-123",
  }), /motivo del rechazo/i);
});
