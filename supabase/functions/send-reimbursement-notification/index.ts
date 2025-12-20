import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

/**
 * EDGE FUNCTION DESACTIVADA TEMPORALMENTE
 * 
 * Esta función enviaba SMS usando Twilio.
 * Para reactivarla:
 * 1. Configurar los secrets TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 * 2. Descomentar el código de envío de SMS
 * 3. Reactivar los triggers en la BD:
 *    - notify_reimbursement_status_change
 *    - notify_new_reimbursement
 *    - notify_supplier_payment_created
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReimbursementNotificationRequest {
  user_phone: string;
  user_name: string;
  reimbursement_type: string;
  subject: string;
  amount: number;
  status: string;
  folio: number;
  rejection_reason?: string;
  creator_name?: string;
  user_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      user_phone,
      user_name,
      reimbursement_type,
      subject,
      amount,
      status,
      folio,
      rejection_reason,
      creator_name,
      user_id,
    }: ReimbursementNotificationRequest = await req.json();

    console.log("SMS notification received (DISABLED):", {
      user_phone,
      user_name,
      status,
      folio,
      reimbursement_type,
    });

    // DESACTIVADO: Código de envío de SMS con Twilio
    /*
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
      }).format(value);
    };

    const typeLabel = reimbursement_type === "supplier_payment" 
      ? "Pago a Proveedor" 
      : "Rendición";

    let smsMessage = `Pre Kinder B\n`;
    
    if (status === "pending") {
      smsMessage += `Nueva ${typeLabel} #${folio}\n`;
      smsMessage += `De: ${creator_name || 'Usuario'}\n`;
      smsMessage += `Monto: ${formatCurrency(amount)}\n`;
      const maxSubject = 80 - smsMessage.length;
      smsMessage += `${subject.substring(0, maxSubject)}${subject.length > maxSubject ? '...' : ''}`;
    } else {
      const statusLabel = status === "approved" ? "APROBADA" : "RECHAZADA";
      smsMessage += `${typeLabel} #${folio} ${statusLabel}\n`;
      smsMessage += `Monto: ${formatCurrency(amount)}`;
      
      if (status === "rejected" && rejection_reason) {
        const maxReason = 100 - smsMessage.length;
        smsMessage += `\nMotivo: ${rejection_reason.substring(0, maxReason)}${rejection_reason.length > maxReason ? '...' : ''}`;
      }
    }

    let accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    let authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    let twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    // ... código para buscar cuenta de Twilio del usuario ...

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('To', user_phone);
    formData.append('From', twilioPhone);
    formData.append('Body', smsMessage);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const twilioData = await twilioResponse.json();
    console.log("SMS sent successfully:", twilioData.sid);
    */

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Notification received but SMS sending is DISABLED",
      data: { user_phone, user_name, status, folio }
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-reimbursement-notification function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
