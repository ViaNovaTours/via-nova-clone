import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ 
                success: false,
                error: 'Unauthorized - admin only' 
            }, { status: 401 });
        }

        console.log('🔄 Refreshing Casa di Giulietta credentials from environment variables...');
        
        // Get the correct credentials from environment variables
        const consumerKey = Deno.env.get('WOOCOMMERCE_KEY_CASA_DI_GIULIETTA');
        const consumerSecret = Deno.env.get('WOOCOMMERCE_SECRET_CASA_DI_GIULIETTA');

        if (!consumerKey || !consumerSecret) {
            return Response.json({
                success: false,
                error: 'Casa di Giulietta credentials not found in environment variables'
            }, { status: 404 });
        }

        console.log('✅ Found credentials in environment');
        console.log(`Consumer Key: ${consumerKey.substring(0, 10)}...`);
        console.log(`Consumer Secret: ${consumerSecret.substring(0, 10)}...`);

        // Find existing record
        const existing = await base44.asServiceRole.entities.WooCommerceCredentials.filter({ 
            site_name: 'CasaDiGiulietta' 
        });

        if (existing.length === 0) {
            return Response.json({
                success: false,
                error: 'Casa di Giulietta credentials not found in database'
            }, { status: 404 });
        }

        const record = existing[0];
        console.log('📝 Updating existing record:', record.id);

        // Update with correct credentials and URL
        await base44.asServiceRole.entities.WooCommerceCredentials.update(record.id, {
            website_url: 'https://casa-di-giulietta.com',
            api_url: 'https://casa-di-giulietta.com/wp-json/wc/v3',
            consumer_key: consumerKey,
            consumer_secret: consumerSecret,
            is_active: true
        });

        console.log('✅ Credentials updated successfully!');

        // Test the connection
        const auth = btoa(`${consumerKey}:${consumerSecret}`);
        const testUrl = 'https://casa-di-giulietta.com/wp-json/wc/v3/orders?per_page=1';
        
        console.log('🧪 Testing connection...');
        const testResponse = await fetch(testUrl, {
            headers: { 
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        });

        const connectionSuccess = testResponse.ok;
        console.log(`Connection test: ${connectionSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);

        return Response.json({
            success: true,
            message: 'Casa di Giulietta credentials refreshed from environment variables',
            connection_test: connectionSuccess ? 'passed' : 'failed',
            connection_status: testResponse.status,
            updated_url: 'https://casa-di-giulietta.com'
        });

    } catch (error) {
        console.error('❌ Refresh error:', error);
        return Response.json({ 
            success: false, 
            error: error.message
        }, { status: 500 });
    }
});