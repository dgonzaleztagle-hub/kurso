import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

/**
 * EDGE FUNCTION DESACTIVADA TEMPORALMENTE
 * 
 * Esta función enviaba notificaciones por email usando Resend.
 * Para reactivarla:
 * 1. Configurar el secret RESEND_API_KEY
 * 2. Descomentar el código de envío de email
 * 3. Reactivar el trigger notify_payment_submission en la BD
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PaymentNotificationRequest {
  student_name: string;
  amount: number;
  payment_date: string;
  payer_name: string;
  bank: string;
  reference: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { student_name, amount, payment_date, payer_name, bank, reference }: PaymentNotificationRequest = await req.json();

    console.log("Payment notification received (DISABLED):", {
      student_name,
      amount,
      payment_date,
      payer_name,
      bank,
      reference,
    });

    // DESACTIVADO: Código de envío de email con Resend
    /*
    import { Resend } from "https://esm.sh/resend@4.0.0";
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    const emailResponse = await resend.emails.send({
      from: "Colegio <onboarding@resend.dev>",
      to: ["joelcarvajal1@gmail.com"],
      subject: `Nuevo pago pendiente de revisión - ${student_name}`,
      html: `...email HTML...`,
    });

    console.log("Email sent successfully:", emailResponse);
    */

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Notification received but email sending is DISABLED",
      data: { student_name, amount, payment_date }
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-payment-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
