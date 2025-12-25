
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load env vars
// Try loading .env.local first
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
// Then load .env (won't overwrite if already set)
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Optional, but better if we have it

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY/VITE_SUPABASE_PUBLISHABLE_KEY");
    process.exit(1);
}

// Use Service Role if available to bypass RLS, otherwise Anon
const supabase = createClient(supabaseUrl, serviceRoleKey || supabaseKey);

async function seed() {
    const TENANT_NAME = "5z 2026";
    console.log(`Searching for tenant: ${TENANT_NAME}...`);

    const { data: tenant, error: tError } = await supabase
        .from("tenants")
        .select("id")
        .ilike("name", `%${TENANT_NAME}%`)
        .single();

    console.log(`Service Role Key Present: ${!!serviceRoleKey}`);

    // Debug: List all tenants to check visibility
    const { data: allTenants, error: listError } = await supabase.from("tenants").select("id, name").limit(5);
    if (listError) console.error("Error listing tenants:", listError);
    else console.log("Visible Tenants:", allTenants);

    if (tError || !tenant) {
        console.error("Tenant not found!", tError);
        return;
    }

    console.log(`Found Tenant ID: ${tenant.id}`);

    // 1. Insert Activity (Agenda)
    const { error: actError } = await supabase.from("activities").insert({
        tenant_id: tenant.id,
        name: "Paseo de Bienvenida 2026",
        activity_date: "2026-03-15",
        amount: 5000,
        description: JSON.stringify({
            requires_management: true,
            is_with_fee: true,
            description: "🎉 Paseo al Parque Intercomunal. Incluye cuota para asado y bebidas. ¡No faltar!"
        })
    });

    if (actError) console.error("Error inserting Activity:", actError);
    else console.log("✅ Activity 'Paseo de Bienvenida' created.");

    // 2. Insert Meeting Minute (Acta)
    const { error: minError } = await supabase.from("meeting_minutes").insert({
        tenant_id: tenant.id,
        title: "Primera Reunión de Apoderados",
        content: "TEMAS TRATADOS:\n\n1. Elección de Directiva: Se mantiene la directiva del año anterior.\n2. Cuota Anual: Se fija en $20.000 pagadera en 10 meses.\n3. Eventos: Se propone realizar una rifa en Mayo.\n\nACUERDOS:\n- Todos los apoderados deben firmar el libro de asistencia.\n- Próxima reunión el 5 de Abril.",
        meeting_date: "2026-03-01",
        status: "published"
    });

    if (minError) console.error("Error inserting Minute:", minError);
    else console.log("✅ Meeting Minute 'Primera Reunión' created.");
}

seed();
