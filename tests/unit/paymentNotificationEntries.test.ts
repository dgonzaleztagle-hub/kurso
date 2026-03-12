import test from "node:test";
import assert from "node:assert/strict";

import { buildApprovalEntries } from "../../supabase/functions/_shared/paymentNotificationEntries.ts";

test("buildApprovalEntries keeps activities and groups contiguous monthly fees", () => {
  const entries = buildApprovalEntries({
    payment_date: "2026-03-10",
    student_id: 9,
    amount: 24000,
    students: {
      first_name: "Ana",
      last_name: "Pérez",
    },
    payment_details: {
      selected_debts: [
        { type: "activity", id: 3, name: "Taller", amount: 10000, paid_amount: 10000 },
        { type: "monthly_fee", id: "2026-MARZO", name: "Cuota Marzo", amount: 7000, paid_amount: 7000, months: ["MARZO"] },
        { type: "monthly_fee", id: "2026-ABRIL", name: "Cuota Abril", amount: 7000, paid_amount: 7000, target_month: "2026-ABRIL" },
      ],
    },
  });

  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0], {
    payment_date: "2026-03-10",
    student_id: 9,
    student_name: "Ana Pérez",
    activity_id: 3,
    concept: "Taller",
    amount: 10000,
    month_period: null,
  });
  assert.deepEqual(entries[1], {
    payment_date: "2026-03-10",
    student_id: 9,
    student_name: "Ana Pérez",
    activity_id: null,
    concept: "Cuota MARZO-ABRIL",
    amount: 14000,
    month_period: "MARZO-ABRIL",
  });
});

test("buildApprovalEntries falls back to a single monthly entry when no debt allocation exists", () => {
  const entries = buildApprovalEntries({
    payment_date: "2026-03-10",
    student_id: 5,
    amount: 5000,
    students: null,
    payment_details: null,
  });

  assert.deepEqual(entries, [{
    payment_date: "2026-03-10",
    student_id: 5,
    student_name: "Estudiante desconocido",
    activity_id: null,
    concept: "Cuota Mensual",
    amount: 5000,
    month_period: null,
  }]);
});
