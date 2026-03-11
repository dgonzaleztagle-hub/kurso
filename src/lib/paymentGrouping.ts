import {
  SCHOOL_MONTHS,
  type PaymentLike,
  type SchoolMonthName,
  normalizeMonthToken,
  parseMonthPeriodToMonths,
} from "@/lib/creditAccounting";

type RawPayment = PaymentLike & {
  id: string;
  folio: number;
  student_id?: string | number | null;
  student_name?: string | null;
  payment_date: string;
  concept: string;
  amount: number;
  activity_id?: string | number | null;
};

export interface GroupedPayment {
  id: string;
  paymentIds: string[];
  folioStart: number;
  folioEnd: number;
  folioLabel: string;
  studentId: string | number | null;
  studentName: string | null;
  paymentDate: string;
  concept: string;
  monthPeriod: string | null;
  monthPeriods: SchoolMonthName[];
  amount: number;
  isGrouped: boolean;
  rawPayments: RawPayment[];
}

const monthIndexMap = new Map(SCHOOL_MONTHS.map((month, index) => [month.name, index]));

const areConsecutiveFolios = (payments: RawPayment[]) => {
  const sorted = [...payments].sort((a, b) => a.folio - b.folio);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].folio !== sorted[index - 1].folio + 1) {
      return false;
    }
  }
  return true;
};

const getMonthlyConceptMonths = (concept: string): SchoolMonthName[] => {
  const normalizedConcept = String(concept || "").trim().toUpperCase();
  if (!normalizedConcept.startsWith("CUOTA")) return [];
  const raw = normalizedConcept.replace(/^CUOTA\s+/, "");
  return parseMonthPeriodToMonths(raw);
};

const extractMonthsFromPayment = (payment: RawPayment): SchoolMonthName[] => {
  const monthPeriods = parseMonthPeriodToMonths(payment.month_period);
  if (monthPeriods.length > 0) return monthPeriods;
  return getMonthlyConceptMonths(payment.concept);
};

const dedupeMonths = (months: SchoolMonthName[]) => {
  const seen = new Set<SchoolMonthName>();
  return months.filter((month) => {
    if (seen.has(month)) return false;
    seen.add(month);
    return true;
  });
};

const sortMonths = (months: SchoolMonthName[]) =>
  [...months].sort((left, right) => (monthIndexMap.get(left) || 0) - (monthIndexMap.get(right) || 0));

const buildMonthPeriodValue = (months: SchoolMonthName[]) => {
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
};

const buildMonthlyConcept = (months: SchoolMonthName[]) => {
  const period = buildMonthPeriodValue(months);
  return period ? `Cuota ${period}` : "Cuota Mensual";
};

const isMonthlyPayment = (payment: RawPayment) =>
  !payment.activity_id && String(payment.concept || "").trim().toUpperCase().startsWith("CUOTA");

export const buildMonthlyPaymentMetadata = (months: string[]) => {
  const normalizedMonths = months
    .map((month) => normalizeMonthToken(month))
    .filter((month): month is SchoolMonthName => month !== null);
  const monthPeriod = buildMonthPeriodValue(normalizedMonths);

  return {
    months: sortMonths(dedupeMonths(normalizedMonths)),
    monthPeriod,
    concept: buildMonthlyConcept(normalizedMonths),
  };
};

export const groupPaymentsForDisplay = <T extends RawPayment>(payments: T[]): GroupedPayment[] => {
  const monthlyBuckets = new Map<string, T[]>();
  const nonMonthlyPayments: T[] = [];

  payments.forEach((payment) => {
    if (!isMonthlyPayment(payment)) {
      nonMonthlyPayments.push(payment);
      return;
    }

    const bucketKey = `${payment.student_id ?? payment.student_name ?? "sin-estudiante"}|${payment.payment_date}`;
    const current = monthlyBuckets.get(bucketKey) || [];
    current.push(payment);
    monthlyBuckets.set(bucketKey, current);
  });

  const groupedPayments: GroupedPayment[] = [];

  monthlyBuckets.forEach((bucket) => {
    const sortedBucket = [...bucket].sort((left, right) => left.folio - right.folio);
    const shouldGroup = sortedBucket.length > 1 && areConsecutiveFolios(sortedBucket);

    if (!shouldGroup) {
      sortedBucket.forEach((payment) => {
        const months = extractMonthsFromPayment(payment);
        groupedPayments.push({
          id: payment.id,
          paymentIds: [payment.id],
          folioStart: payment.folio,
          folioEnd: payment.folio,
          folioLabel: String(payment.folio),
          studentId: payment.student_id ?? null,
          studentName: payment.student_name ?? null,
          paymentDate: payment.payment_date,
          concept: months.length > 0 ? buildMonthlyConcept(months) : payment.concept,
          monthPeriod: months.length > 0 ? buildMonthPeriodValue(months) : payment.month_period || null,
          monthPeriods: months,
          amount: Number(payment.amount || 0),
          isGrouped: false,
          rawPayments: [payment],
        });
      });
      return;
    }

    const months = sortMonths(dedupeMonths(sortedBucket.flatMap(extractMonthsFromPayment)));
    const monthPeriod = buildMonthPeriodValue(months);
    groupedPayments.push({
      id: sortedBucket[0].id,
      paymentIds: sortedBucket.map((payment) => payment.id),
      folioStart: sortedBucket[0].folio,
      folioEnd: sortedBucket[sortedBucket.length - 1].folio,
      folioLabel: `${sortedBucket[0].folio}-${sortedBucket[sortedBucket.length - 1].folio}`,
      studentId: sortedBucket[0].student_id ?? null,
      studentName: sortedBucket[0].student_name ?? null,
      paymentDate: sortedBucket[0].payment_date,
      concept: buildMonthlyConcept(months),
      monthPeriod,
      monthPeriods: months,
      amount: sortedBucket.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      isGrouped: true,
      rawPayments: sortedBucket,
    });
  });

  nonMonthlyPayments.forEach((payment) => {
    groupedPayments.push({
      id: payment.id,
      paymentIds: [payment.id],
      folioStart: payment.folio,
      folioEnd: payment.folio,
      folioLabel: String(payment.folio),
      studentId: payment.student_id ?? null,
      studentName: payment.student_name ?? null,
      paymentDate: payment.payment_date,
      concept: payment.concept,
      monthPeriod: payment.month_period || null,
      monthPeriods: extractMonthsFromPayment(payment),
      amount: Number(payment.amount || 0),
      isGrouped: false,
      rawPayments: [payment],
    });
  });

  return groupedPayments.sort((left, right) => {
    const dateCompare = new Date(right.paymentDate).getTime() - new Date(left.paymentDate).getTime();
    if (dateCompare !== 0) return dateCompare;
    return right.folioEnd - left.folioEnd;
  });
};
