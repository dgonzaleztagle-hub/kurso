const SCHOOL_MONTHS = [
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
] as const;

type SchoolMonthName = typeof SCHOOL_MONTHS[number];

export type PaymentDebt = {
  type: "activity" | "monthly_fee";
  id?: number | string | null;
  name: string;
  amount: number;
  paid_amount?: number;
  target_month?: string;
  months?: string[];
};

export type PaymentDetails = {
  selected_debts?: PaymentDebt[];
  remainder_to_monthly_fees?: number;
} | null;

export type PaymentNotificationRow = {
  payment_date: string;
  student_id: number | null;
  amount: number;
  payment_details: PaymentDetails;
  students?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};

export type PaymentEntry = {
  payment_date: string;
  student_id: number | null;
  student_name: string;
  activity_id: number | null;
  concept: string;
  amount: number;
  month_period: string | null;
};

const monthIndexMap = new Map(SCHOOL_MONTHS.map((month, index) => [month, index]));

function normalizeMonthToken(value: string | null | undefined): SchoolMonthName | null {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  if (monthIndexMap.has(normalized as SchoolMonthName)) {
    return normalized as SchoolMonthName;
  }

  const segments = normalized.split("-");
  const trailingToken = segments[segments.length - 1];
  return monthIndexMap.has(trailingToken as SchoolMonthName)
    ? (trailingToken as SchoolMonthName)
    : null;
}

function dedupeMonths(months: SchoolMonthName[]) {
  const seen = new Set<SchoolMonthName>();
  return months.filter((month) => {
    if (seen.has(month)) return false;
    seen.add(month);
    return true;
  });
}

function sortMonths(months: SchoolMonthName[]) {
  return [...months].sort((left, right) => (monthIndexMap.get(left) || 0) - (monthIndexMap.get(right) || 0));
}

function buildMonthPeriodValue(months: SchoolMonthName[]) {
  if (months.length === 0) return null;
  if (months.length === 1) return months[0];

  const sorted = sortMonths(dedupeMonths(months));
  const indexes = sorted.map((month) => monthIndexMap.get(month) || 0);
  const isContiguous = indexes.every((monthIndex, index) =>
    index === 0 ? true : monthIndex === indexes[index - 1] + 1,
  );

  if (isContiguous) {
    return `${sorted[0]}-${sorted[sorted.length - 1]}`;
  }

  return sorted.join(",");
}

function buildMonthlyConcept(months: SchoolMonthName[]) {
  const period = buildMonthPeriodValue(months);
  return period ? `Cuota ${period}` : "Cuota Mensual";
}

function extractMonthlyPaymentEntry(notification: PaymentNotificationRow, debts: PaymentDebt[], studentName: string): PaymentEntry | null {
  const totalMonthlyAmount = debts.reduce((sum, debt) => sum + (Number(debt.paid_amount) || 0), 0);
  if (totalMonthlyAmount <= 0) return null;

  const months = debts.flatMap((debt) => {
    if (Array.isArray(debt.months) && debt.months.length > 0) {
      return debt.months
        .map((month) => normalizeMonthToken(month))
        .filter((month): month is SchoolMonthName => month !== null);
    }

    const normalizedTarget = normalizeMonthToken(debt.target_month);
    return normalizedTarget ? [normalizedTarget] : [];
  });

  const sortedMonths = sortMonths(dedupeMonths(months));

  return {
    payment_date: notification.payment_date,
    student_id: notification.student_id,
    student_name: studentName,
    activity_id: null,
    concept: buildMonthlyConcept(sortedMonths),
    amount: totalMonthlyAmount,
    month_period: buildMonthPeriodValue(sortedMonths),
  };
}

export function buildApprovalEntries(notification: PaymentNotificationRow) {
  const studentName = `${notification.students?.first_name || ""} ${notification.students?.last_name || ""}`.trim() || "Estudiante desconocido";
  const selectedDebts = Array.isArray(notification.payment_details?.selected_debts)
    ? notification.payment_details?.selected_debts || []
    : [];

  if (selectedDebts.length === 0) {
    return [{
      payment_date: notification.payment_date,
      student_id: notification.student_id,
      student_name: studentName,
      activity_id: null,
      concept: "Cuota Mensual",
      amount: Number(notification.amount) || 0,
      month_period: null,
    }] satisfies PaymentEntry[];
  }

  const activityEntries = selectedDebts
    .filter((debt) => debt.type === "activity")
    .map((debt) => ({
      payment_date: notification.payment_date,
      student_id: notification.student_id,
      student_name: studentName,
      activity_id: debt.id ? Number(debt.id) : null,
      concept: debt.name,
      amount: Number(debt.paid_amount) || 0,
      month_period: null,
    }))
    .filter((entry) => entry.amount > 0);

  const monthlyEntry = extractMonthlyPaymentEntry(
    notification,
    selectedDebts.filter((debt) => debt.type === "monthly_fee"),
    studentName,
  );

  return monthlyEntry ? [...activityEntries, monthlyEntry] : activityEntries;
}
