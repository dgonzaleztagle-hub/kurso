import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''; // Use Anon key for Login
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Env Vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const adminClient = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);

async function verify() {
    const rut = "19788597-1";
    const rutClean = rut.replace(/\./g, '').replace(/-/g, '').toLowerCase(); // 197885971
    const email = `${rutClean}@kurso.cl`;
    const password = rutClean.substring(0, 6); // 197885

    console.log(`Checking credentials for RUT: ${rut}`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);

    // 1. Check if user exists (Admin)
    if (supabaseServiceKey) {
        const { data: { users }, error } = await adminClient.auth.admin.listUsers();
        if (error) {
            console.error("Admin List Error:", error.message);
        } else {
            const found = users?.find(u => u.email === email);
            if (found) {
                console.log("✅ User EXISTS in Auth system.");
                console.log("   ID:", found.id);
                console.log("   Confirmed:", found.email_confirmed_at ? "Yes" : "No");
            } else {
                console.error("❌ User DOES NOT EXIST in Auth system.");
                console.log("   Conclusion: The 'Generar Cuentas' button failed to create the user.");
                return;
            }
        }
    }

    // 2. Try Login
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        console.error("❌ Login Attempt Failed:", error.message);
    } else {
        console.log("✅ Login Attempt SUCCESS!");
        console.log("   Session User:", data.user.email);
    }
}

verify();
