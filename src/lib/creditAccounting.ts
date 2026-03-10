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

  let remainingDirectCoverage = payments
    .filter((payment) => String(payment.concept || "").toLowerCase().startsWith("cuota"))
    .reduce((sum, payment) => sum + getNetPaymentAmount(payment), 0);

  return payableMonths.map((monthInfo) => {
    const directApplied = Math.min(monthlyFee, remainingDirectCoverage);
    remainingDirectCoverage = Math.max(0, remainingDirectCoverage - directApplied);
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
