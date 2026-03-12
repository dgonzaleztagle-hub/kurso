import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

type PaymentDebt = {
  type: "activity" | "monthly_fee";
  id?: number | string | null;
  name: string;
  amount: number;
  paid_amount?: number;
  target_month?: string;
  months?: string[];
};

type PaymentDetails = {
  selected_debts?: PaymentDebt[];
  remainder_to_monthly_fees?: number;
} | null;

type NotificationRow = {
  id: string;
  tenant_id: string;
  student_id: number | null;
  payment_date: string;
  amount: number;
  status: string;
  payment_details: PaymentDetails;
  students?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};

type PaymentEntry = {
  payment_date: string;
  student_id: number | null;
  student_name: string;
  activity_id: number | null;
  concept: string;
  amount: number;
  month_period: string | null;
};

const monthIndexMap = new Map(SCHOOL_MONTHS.map((month, index) => [month, index]));

const normalizeMonthToken = (value: string | null | undefined): SchoolMonthName | null => {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  if (monthIndexMap.has(normalized as SchoolMonthName)) {
    return normalized as SchoolMonthName;
  }

  const segments = normalized.split("-");
  const trailingToken = segments[segments.length - 1];
  return monthIndexMap.has(trailingToken as SchoolMonthName) ? (trailingToken as SchoolMonthName) : null;
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

const extractMonthlyPaymentEntry = (notification: NotificationRow, debts: PaymentDebt[], studentName: string): PaymentEntry | null => {
  const totalMonthlyAmount = debts.reduce((sum, debt) => sum + (Number(debt.paid_amount) || 0), 0);
  if (totalMonthlyAmount <= 0) return null;

  const months = debts.flatMap((debt) => {
    if (Array.isArray(debt.months) && debt.months.length > 0) {
      return debt.months.map((month) => normalizeMonthToken(month)).filter((month): month is SchoolMonthName => month !== null);
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
};

const buildApprovalEntries = (notification: NotificationRow) => {
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
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { notificationId, action, rejectionReason } = await req.json();
    if (!notificationId || !action) {
      return new Response(
        JSON.stringify({ error: "notificationId y action son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: notification, error: notificationError } = await supabaseAdmin
      .from("payment_notifications")
      .select(`
        id,
        tenant_id,
        student_id,
        payment_date,
        amount,
        status,
        payment_details,
        students (
          first_name,
          last_name
        )
      `)
      .eq("id", notificationId)
      .maybeSingle();

    if (notificationError || !notification) {
      return new Response(
        JSON.stringify({ error: "Notificación no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const [{ data: appUser }, { data: ownerTenant }, { data: memberRole }] = await Promise.all([
      supabaseAdmin
        .from("app_users")
        .select("is_superadmin")
        .eq("id", callerUser.id)
        .maybeSingle(),
      supabaseAdmin
        .from("tenants")
        .select("id")
        .eq("id", notification.tenant_id)
        .eq("owner_id", callerUser.id)
        .maybeSingle(),
      supabaseAdmin
        .from("tenant_members")
        .select("role")
        .eq("tenant_id", notification.tenant_id)
        .eq("user_id", callerUser.id)
        .in("role", ["owner", "master", "admin"])
        .eq("status", "active")
        .maybeSingle(),
    ]);

    const canProcess = Boolean(appUser?.is_superadmin || ownerTenant || memberRole);
    if (!canProcess) {
      return new Response(
        JSON.stringify({ error: "No autorizado para procesar pagos en este curso" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "approve") {
      const paymentEntries = buildApprovalEntries(notification as NotificationRow);
      if (paymentEntries.length === 0) {
        return new Response(
          JSON.stringify({ error: "La notificación no contiene pagos aplicables" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data, error } = await supabaseAdmin.rpc("approve_payment_notification_transaction", {
        target_notification_id: notificationId,
        payment_entries: paymentEntries,
        target_processed_by: callerUser.id,
      });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, result: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "reject") {
      if (!String(rejectionReason || "").trim()) {
        return new Response(
          JSON.stringify({ error: "Debe indicar el motivo del rechazo" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data, error } = await supabaseAdmin.rpc("reject_payment_notification_transaction", {
        target_notification_id: notificationId,
        target_processed_by: callerUser.id,
        target_rejection_reason: String(rejectionReason).trim(),
      });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, result: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Acción no soportada" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
