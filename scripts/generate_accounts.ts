
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Must be added to .env manually by user if not present

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    console.error('Please add SUPABASE_SERVICE_ROLE_KEY=... to your .env file.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function main() {
    console.log("🚀 Starting Student Account Generation (Local Mode)...");

    // 1. Get arguments (Optional Tenant ID)
    const tenantIdArg = process.argv[2];

    // 2. Query Students who need accounts
    let query = supabase.from('students').select('id, first_name, last_name, rut, tenant_id').is('rut', 'not.null');

    if (tenantIdArg) {
        console.log(`Filtering by Tenant ID: ${tenantIdArg}`);
        query = query.eq('tenant_id', tenantIdArg);
    }

    const { data: students, error: fetchError } = await query;

    if (fetchError) {
        console.error("Error fetching students:", fetchError);
        return;
    }

    console.log(`Found ${students.length} students with RUT.`);

    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const student of students) {
        // Check if user already exists (linked via user_students)
        const { data: existingLinks } = await supabase
            .from('user_students')
            .select('user_id')
            .eq('student_id', student.id);

        if (existingLinks && existingLinks.length > 0) {
            // console.log(`Skipping ${student.first_name}: Already linked.`);
            skippedCount++;
            continue;
        }

        // Generate Credentials
        const rutClean = student.rut.replace(/\./g, '').replace(/-/g, '').toLowerCase();
        const email = `${rutClean}@kurso.cl`;
        const password = rutClean.substring(0, 6); // Password: First 6 digits of RUT

        // console.log(`Creating account for ${student.first_name} ${student.last_name} (${email})...`);

        // Create User
        const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: {
                full_name: `${student.first_name} ${student.last_name}`,
                rut: student.rut,
                role: 'alumnos' // Metadata role
            }
        });

        if (createError) {
            // If ALREADY registered, try to link?
            // console.error(`Failed to create user for ${student.rut}: ${createError.message}`);
            errorCount++;
            continue;
        }

        const userId = authUser.user.id;

        // Assign Role 'alumnos' in user_roles
        const { error: roleError } = await supabase.from('user_roles').insert({
            user_id: userId,
            role: 'alumnos', // Ensure 'alumnos' is in Enum (We fixed this already)
            user_name: `${student.first_name} ${student.last_name}`,
            first_login: true // Force password change on first login
        });

        if (roleError) console.error("Role Link Error:", roleError.message);

        // Link User to Student in user_students
        const { error: linkError } = await supabase.from('user_students').insert({
            user_id: userId,
            student_id: student.id,
            display_name: `${student.first_name} ${student.last_name}`
        });

        if (linkError) console.error("Link Error:", linkError.message);

        // Add to Tenant Members as 'student' role
        const { error: memberError } = await supabase.from('tenant_members').insert({
            tenant_id: student.tenant_id,
            user_id: userId,
            role: 'student',
            status: 'active'
        });

        if (!roleError && !linkError) {
            createdCount++;
            console.log(`✅ Created: ${student.first_name} ${student.last_name}`);
        }
    }

    console.log("------------------------------------------------");
    console.log(`Finished! Created: ${createdCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
}

main();
