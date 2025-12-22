import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Move expired Trial to Grace Period
        const { data: expiredTrials, error: trialError } = await supabaseClient
            .from('tenants')
            .select('id, name')
            .eq('subscription_status', 'trial')
            .lt('trial_ends_at', new Date().toISOString())

        if (trialError) throw trialError

        if (expiredTrials?.length > 0) {
            console.log(`Moving ${expiredTrials.length} tenants to Grace Period`)
            for (const tenant of expiredTrials) {
                await supabaseClient
                    .from('tenants')
                    .update({ subscription_status: 'grace_period' })
                    .eq('id', tenant.id)
            }
        }

        // 2. Wipeout Tenants in Grace Period > 3 days
        // "trial_ends_at" was when trial ended. Grace period is 3 days AFTER trial_ends_at.
        const threeDaysAgo = new Date()
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

        const { data: wipeCandidates, error: wipeError } = await supabaseClient
            .from('tenants')
            .select('id, name, trial_ends_at')
            .eq('subscription_status', 'grace_period')
            .lt('trial_ends_at', threeDaysAgo.toISOString())

        if (wipeError) throw wipeError

        if (wipeCandidates?.length > 0) {
            console.log(`WIPING OUT ${wipeCandidates.length} tenants`)
            for (const tenant of wipeCandidates) {
                // Nuclear Wipeout: Delete the tenant.
                // Cascades should handle related data (users, payments, etc.) IF configured.
                // Assuming 'tenants' has ON DELETE CASCADE on relations, or we need to delete manually.
                // Usually deleting the tenant is enough if relations are strong.
                // CRITICAL: We just delete the tenant row.
                const { error: delError } = await supabaseClient
                    .from('tenants')
                    .delete()
                    .eq('id', tenant.id)

                if (delError) console.error(`Failed to wipe tenant ${tenant.id}:`, delError)
                else console.log(`Wiped tenant ${tenant.id} (${tenant.name})`)
            }
        }

        return new Response(
            JSON.stringify({
                message: 'Subscription check completed',
                moved_to_grace: expiredTrials?.length || 0,
                wiped_out: wipeCandidates?.length || 0
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
