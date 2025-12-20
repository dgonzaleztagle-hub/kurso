
const supabaseUrl = 'https://ktdrnpdtmzfvfyvywrzs.supabase.co';
const supabaseKey = 'sb_publishable_343vUP4XblOuiw0GMNTUXw_JMs8fW3q';

async function testConnection() {
    console.log("Testing connection to:", supabaseUrl);
    console.log("Key:", supabaseKey);

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/app_users?select=*&limit=1`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json' // 406 fix attempt?
            }
        });

        console.log("Status:", response.status);
        console.log("StatusText:", response.statusText);

        if (!response.ok) {
            console.log("Response Body:", await response.text());
        } else {
            console.log("Success! Data:", await response.json());
        }
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

testConnection();
