import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // Define tour name mapping (variations -> canonical name)
        const tourMapping = {
            'Peles Castle Tour': 'Peles Castle',
            'Bran Castle Tour': 'Bran Castle',
            'Corvin Castle Tour': 'Corvin Castle',
            "Villa d'Este Tour": "Villa d'Este",
            'Casa di Giulietta Tour': 'Casa di Giulietta',
            "Hadrian's Villa Tour": "Hadrian's Villa",
            'Alcatraz Island Tour': 'Alcatraz Island',
            'Pena Palace Tour': 'Pena Palace',
            'Statue of Liberty Tour': 'Statue of Liberty'
        };

        let ordersUpdated = 0;
        let adSpendsUpdated = 0;

        // Update Orders one at a time to avoid rate limits
        for (const [oldName, newName] of Object.entries(tourMapping)) {
            const ordersToUpdate = await base44.asServiceRole.entities.Order.filter({ tour: oldName });
            for (const order of ordersToUpdate) {
                await base44.asServiceRole.entities.Order.update(order.id, { tour: newName });
                ordersUpdated++;
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        // Update AdSpend one at a time to avoid rate limits
        for (const [oldName, newName] of Object.entries(tourMapping)) {
            const adsToUpdate = await base44.asServiceRole.entities.AdSpend.filter({ tour_name: oldName });
            for (const ad of adsToUpdate) {
                await base44.asServiceRole.entities.AdSpend.update(ad.id, { tour_name: newName });
                adSpendsUpdated++;
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        return Response.json({
            success: true,
            ordersUpdated,
            adSpendsUpdated,
            message: `Consolidated ${ordersUpdated} orders and ${adSpendsUpdated} ad spend records`
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});