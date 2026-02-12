import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const consumerKey = Deno.env.get("WOOCOMMERCE_KEY_BRAN_CASTLE");
        const consumerSecret = Deno.env.get("WOOCOMMERCE_SECRET_BRAN_CASTLE");

        if (!consumerKey || !consumerSecret) {
            return Response.json({ error: 'Missing Bran Castle API credentials' }, { status: 400 });
        }

        const auth = btoa(`${consumerKey}:${consumerSecret}`);

        // Fetch orders 2381 and 2379
        const [order2381Response, order2379Response] = await Promise.all([
            fetch(`https://brancastletickets.ro/wp-json/wc/v3/orders/2381`, {
                headers: { 'Authorization': `Basic ${auth}` }
            }),
            fetch(`https://brancastletickets.ro/wp-json/wc/v3/orders/2379`, {
                headers: { 'Authorization': `Basic ${auth}` }
            })
        ]);

        const order2381 = await order2381Response.json();
        const order2379 = await order2379Response.json();

        // Also check our database
        const dbOrders = await base44.entities.Order.filter({ 
            order_id: ['BranCastle-2381', 'BranCastle-2379']
        });

        return Response.json({
            woocommerce_data: {
                order_2381: {
                    id: order2381.id,
                    status: order2381.status,
                    total: order2381.total,
                    customer: `${order2381.billing?.first_name} ${order2381.billing?.last_name}`,
                    email: order2381.billing?.email,
                    date_created: order2381.date_created,
                    date_modified: order2381.date_modified,
                    payment_method: order2381.payment_method,
                    transaction_id: order2381.transaction_id
                },
                order_2379: {
                    id: order2379.id,
                    status: order2379.status,
                    total: order2379.total,
                    customer: `${order2379.billing?.first_name} ${order2379.billing?.last_name}`,
                    email: order2379.billing?.email,
                    date_created: order2379.date_created,
                    date_modified: order2379.date_modified,
                    payment_method: order2379.payment_method,
                    transaction_id: order2379.transaction_id
                }
            },
            our_database: dbOrders.map(o => ({
                order_id: o.order_id,
                status: o.status,
                email: o.email,
                created_date: o.created_date,
                updated_date: o.updated_date
            })),
            status_mapping_reference: {
                'pending': 'new',
                'processing': 'new',
                'on-hold': 'on-hold',
                'completed': 'complete',
                'cancelled': 'failed',
                'refunded': 'refunded',
                'failed': 'failed'
            }
        });
    } catch (error) {
        console.error('Debug error:', error);
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});