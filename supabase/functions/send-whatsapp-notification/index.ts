import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

/**
 * EDGE FUNCTION DESACTIVADA TEMPORALMENTE
 * 
 * Esta función enviaba mensajes de WhatsApp usando Twilio.
 * Para reactivarla:
 * 1. Configurar los secrets TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER
 * 2. Descomentar el código de envío de WhatsApp
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppNotificationRequest {
  user_phone: string;
  user_name: string;
  reimbursement_type: string;
  subject: string;
  amount: number;
  status: string;
  folio: number;
  rejection_reason?: string;
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
    }: WhatsAppNotificationRequest = await req.json();

    console.log("WhatsApp notification received (DISABLED):", {
      user_phone,
      status,
      folio,
    });

    // DESACTIVADO: Código de envío de WhatsApp con Twilio
    /*
    if (!user_phone || !user_phone.startsWith('+')) {
      throw new Error('El teléfono debe estar en formato internacional (ej: +56912345678)');
    }

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
      }).format(value);
    };

    const typeLabel = reimbursement_type === "supplier_payment" 
      ? "Pago a Proveedor" 
      : "Rendición";

    const statusEmoji = status === "approved" ? "✅" : "❌";
    const statusLabel = status === "approved" ? "APROBADA" : "RECHAZADA";

    let whatsappMessage = `🏫 *Colegio Pre Kinder B*\n_¡Siempre Subir!_\n\n`;
    whatsappMessage += `${statusEmoji} *${typeLabel} #${folio}*\n`;
    whatsappMessage += `Estado: *${statusLabel}*\n\n`;
    whatsappMessage += `💰 Monto: *${formatCurrency(amount)}*\n`;
    whatsappMessage += `📝 Asunto: ${subject}\n`;
    
    if (status === "rejected" && rejection_reason) {
      whatsappMessage += `\n⚠️ *Motivo del rechazo:*\n${rejection_reason}`;
    } else if (status === "approved") {
      whatsappMessage += `\n✨ El pago será procesado pronto.\n`;
      whatsappMessage += `Recibirás confirmación cuando se complete la transferencia.`;
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioWhatsAppNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('To', `whatsapp:${user_phone}`);
    formData.append('From', twilioWhatsAppNumber);
    formData.append('Body', whatsappMessage);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const twilioData = await twilioResponse.json();
    console.log("WhatsApp sent successfully:", twilioData.sid);
    */

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Notification received but WhatsApp sending is DISABLED",
      data: { user_phone, status, folio }
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending WhatsApp notification:", error);
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
