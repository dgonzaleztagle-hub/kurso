import { parseDateFromDB } from "@/lib/dateUtils";

export const SCHOOL_MONTHS = [
  { name: "MARZO", index: 2 },
  { name: "ABRIL", index: 3 },
  { name: "MAYO", index: 4 },
  { name: "JUNIO", index: 5 },
  { name: "JULIO", index: 6 },
  { name: "AGOSTO", index: 7 },
  { name: "SEPTIEMBRE", index: 8 },
  { name: "OCTUBRE", index: 9 },
  { name: "NOVIEMBRE", index: 10 },
  { name: "DICIEMBRE", index: 11 },
] as const;

export type SchoolMonthName = (typeof SCHOOL_MONTHS)[number]["name"];

export interface PaymentLike {
  amount: number | string | null;
  redirected_amount?: number | string | null;
  concept?: string | null;
  month_period?: string | null;
  activity_id?: number | string | null;
}

export interface CreditApplicationLike {
  amount: number | string | null;
  reversed_amount?: number | string | null;
  target_type: string;
  target_month?: string | null;
  target_activity_id?: number | string | null;
}

export interface MonthDebtItem {
  key: string;
  month: SchoolMonthName;
  label: string;
  due: number;
  paid: number;
  sortOrder: number;
}

export const sameId = (a: unknown, b: unknown) => String(a) === String(b);

export const toSafeNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const getNetPaymentAmount = (payment: PaymentLike) =>
  Math.max(0, toSafeNumber(payment.amount) - toSafeNumber(payment.redirected_amount));

export const getCurrentSchoolYear = () => new Date().getFullYear();

export const getMonthKey = (year: number, month: SchoolMonthName) => `${year}-${month}`;

export const getMonthLabel = (key: string) => {
  const [year, month] = key.split("-");
  return month && year ? `${month} ${year}` : key;
};

const MONTH_NAME_SET = new Set(SCHOOL_MONTHS.map((item) => item.name));

const normalizeMonthName = (value: string | null | undefined): SchoolMonthName | null => {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  return MONTH_NAME_SET.has(normalized as SchoolMonthName) ? (normalized as SchoolMonthName) : null;
};

const resolveMonthKeysFromPeriod = (
  rawPeriod: string | null | undefined,
  payableMonths: Array<{ month: SchoolMonthName; key: string; sortOrder: number }>,
  year: number,
) => {
  if (!rawPeriod) return [] as string[];

  const directMonthName = normalizeMonthName(rawPeriod);
  if (directMonthName) {
    return [getMonthKey(year, directMonthName)];
  }

  const normalized = String(rawPeriod).trim().toUpperCase();

  if (/^\d{4}-[A-ZÁÉÍÓÚÑ]+$/.test(normalized)) {
    return [normalized];
  }

  const [rangeStartRaw, rangeEndRaw] = normalized.split("-");
  const rangeStart = normalizeMonthName(rangeStartRaw);
  const rangeEnd = normalizeMonthName(rangeEndRaw);

  if (rangeStart && rangeEnd) {
    const startIndex = payableMonths.findIndex((month) => month.month === rangeStart);
    const endIndex = payableMonths.findIndex((month) => month.month === rangeEnd);

    if (startIndex >= 0 && endIndex >= startIndex) {
      return payableMonths.slice(startIndex, endIndex + 1).map((month) => month.key);
    }
  }

  return [] as string[];
};

export const getPayableSchoolMonths = (
  enrollmentDateRaw: string,
  year = getCurrentSchoolYear(),
  period: "current" | "year" = "year",
) => {
  const enrollmentDate = parseDateFromDB(enrollmentDateRaw);
  const enrollmentYear = enrollmentDate.getFullYear();
  const enrollmentMonth = enrollmentDate.getMonth();
  const currentMonthIndex = new Date().getMonth();

  if (enrollmentYear > year) {
    return [] as Array<{ month: SchoolMonthName; key: string; sortOrder: number }>;
  }

  let firstMonthIndex = 2;
  if (enrollmentYear === year && enrollmentMonth > 2) {
    firstMonthIndex = enrollmentMonth;
  }

  let maxMonthIndex = 11;
  if (period === "current" && year === getCurrentSchoolYear()) {
    maxMonthIndex = Math.max(2, currentMonthIndex);
  }

  return SCHOOL_MONTHS
    .filter((item) => item.index >= firstMonthIndex && item.index <= maxMonthIndex)
    .map((item) => ({
      month: item.name,
      key: getMonthKey(year, item.name),
      sortOrder: item.index,
    }));
};

export const calculateMonthlyDebtItems = ({
  enrollmentDate,
  monthlyFee,
  payments,
  applications,
  year = getCurrentSchoolYear(),
  period = "year",
}: {
  enrollmentDate: string;
  monthlyFee: number;
  payments: PaymentLike[];
  applications: CreditApplicationLike[];
  year?: number;
  period?: "current" | "year";
}): MonthDebtItem[] => {
  const payableMonths = getPayableSchoolMonths(enrollmentDate, year, period);
  const creditByMonth = new Map<string, number>();
  const directByMonth = new Map<string, number>();

  const applyAmountAcrossMonths = (amount: number, monthKeys: string[]) => {
    let remaining = amount;

    for (const monthKey of monthKeys) {
      if (remaining <= 0) break;
      if (!payableMonths.some((month) => month.key === monthKey)) continue;

      const current = directByMonth.get(monthKey) || 0;
      const available = Math.max(0, monthlyFee - current);
      if (available <= 0) continue;

      const applied = Math.min(remaining, available);
      directByMonth.set(monthKey, current + applied);
      remaining -= applied;
    }

    return remaining;
  };

  applications
    .filter((application) => application.target_type === "monthly_fee" && application.target_month)
    .forEach((application) => {
      const key = String(application.target_month);
      const current = creditByMonth.get(key) || 0;
      creditByMonth.set(
        key,
        current + Math.max(0, toSafeNumber(application.amount) - toSafeNumber(application.reversed_amount)),
      );
    });

  let untargetedDirectCoverage = 0;

  payments
    .filter((payment) => String(payment.concept || "").toLowerCase().startsWith("cuota"))
    .forEach((payment) => {
      let remaining = getNetPaymentAmount(payment);
      if (remaining <= 0) return;

      const targetedMonthKeys = resolveMonthKeysFromPeriod(payment.month_period, payableMonths, year);
      if (targetedMonthKeys.length > 0) {
        remaining = applyAmountAcrossMonths(remaining, targetedMonthKeys);
      }

      untargetedDirectCoverage += remaining;
    });

  untargetedDirectCoverage = applyAmountAcrossMonths(
    untargetedDirectCoverage,
    payableMonths.map((month) => month.key),
  );

  return payableMonths.map((monthInfo) => {
    const directApplied = directByMonth.get(monthInfo.key) || 0;
    const creditApplied = creditByMonth.get(monthInfo.key) || 0;
    const paid = directApplied + creditApplied;

    return {
      key: monthInfo.key,
      month: monthInfo.month,
      label: getMonthLabel(monthInfo.key),
      due: Math.max(0, monthlyFee - paid),
      paid,
      sortOrder: monthInfo.sortOrder,
    };
  });
};

export const getAppliedCreditForActivity = (
  applications: CreditApplicationLike[],
  activityId: number | string,
) =>
  applications
    .filter(
      (application) =>
        application.target_type === "activity" && sameId(application.target_activity_id, activityId),
    )
    .reduce(
      (sum, application) => sum + Math.max(0, toSafeNumber(application.amount) - toSafeNumber(application.reversed_amount)),
      0,
    );
