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

        console.log('🔧 Fixing Casa di Giulietta credentials...');
        
        // Get the correct credentials from environment variables (secrets)
        const consumerKey = Deno.env.get('WOOCOMMERCE_KEY_CASA_DI_GIULIETTA');
        const consumerSecret = Deno.env.get('WOOCOMMERCE_SECRET_CASA_DI_GIULIETTA');

        if (!consumerKey || !consumerSecret) {
            return Response.json({
                success: false,
                error: 'Casa di Giulietta credentials not found in environment variables. Please check your secrets in Base44 settings.'
            }, { status: 404 });
        }

        console.log('✅ Found credentials in environment');

        // Find existing record
        const existing = await base44.asServiceRole.entities.WooCommerceCredentials.filter({ 
            site_name: 'CasaDiGiulietta' 
        });

        if (existing.length === 0) {
            return Response.json({
                success: false,
                error: 'Casa di Giulietta record not found in database. Please add it via Tour Setup page.'
            }, { status: 404 });
        }

        const record = existing[0];
        console.log('📝 Found record:', record.id);
        console.log('Current URL:', record.website_url);
        console.log('Current Consumer Key:', record.consumer_key?.substring(0, 10) + '...');

        // Update with fresh credentials from environment variables
        await base44.asServiceRole.entities.WooCommerceCredentials.update(record.id, {
            website_url: 'https://casa-di-giulietta.com',
            api_url: 'https://casa-di-giulietta.com/wp-json/wc/v3',
            consumer_key: consumerKey,
            consumer_secret: consumerSecret,
            is_active: true
        });

        console.log('✅ Database updated with fresh credentials!');

        // Test the connection
        const auth = btoa(`${consumerKey}:${consumerSecret}`);
        const testUrl = 'https://casa-di-giulietta.com/wp-json/wc/v3/orders?per_page=1';
        
        console.log('🧪 Testing connection to WooCommerce...');
        const testResponse = await fetch(testUrl, {
            headers: { 
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        });

        if (testResponse.ok) {
            const testOrders = await testResponse.json();
            console.log(`✅ Connection successful! Found ${testOrders.length} order(s)`);
            
            return Response.json({
                success: true,
                message: '✅ Casa di Giulietta credentials fixed and tested successfully!',
                connection_test: 'passed',
                orders_found: testOrders.length,
                updated_url: 'https://casa-di-giulietta.com',
                next_step: 'Now click "Sync WooCommerce" on the Dashboard to import orders!'
            });
        } else {
            const errorText = await testResponse.text();
            console.log(`❌ Connection test failed: ${testResponse.status}`);
            
            return Response.json({
                success: false,
                error: 'Credentials updated but connection test failed',
                connection_status: testResponse.status,
                connection_error: errorText,
                note: 'Please verify the credentials are correct in your WooCommerce REST API settings'
            }, { status: 500 });
        }

    } catch (error) {
        console.error('❌ Fix error:', error);
        return Response.json({ 
            success: false, 
            error: error.message,
            stack: error.stack?.split('\n').slice(0, 5)
        }, { status: 500 });
    }
});