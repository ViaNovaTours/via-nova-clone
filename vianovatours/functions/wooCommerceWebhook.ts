import { createHmac } from 'node:crypto';
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const WOOCOMMERCE_SITES = [
  { name: "AlcatrazTourism", tour_type: "Alcatraz Island Tour", api_url: "https://alcatraztourism.com/wp-json/wc/v3", secret_env: "WOOCOMMERCE_SECRET_ALCATRAZ_TOURISM" },
  { name: "PelesCastle", tour_type: "Peles Castle Tour", api_url: "https://pelescastle.ro/wp-json/wc/v3", secret_env: "WOOCOMMERCE_SECRET_PELES_CASTLE" },
  { name: "BranCastle", tour_type: "Bran Castle Tour", api_url: "https://brancastletickets.ro/wp-json/wc/v3", secret_env: "WOOCOMMERCE_SECRET_BRAN_CASTLE" },
  { name: "StatueofLiberty", tour_type: "Statue of Liberty Tour", api_url: "https://statueoflibertytickets.org/wp-json/wc/v3", secret_env: "WOOCOMMERCE_SECRET_STATUE_LIBERTY" },
  { name: "CorvinCastle", tour_type: "Corvin Castle Tour", api_url: "https://corvincastle.ro/wp-json/wc/v3", secret_env: "WOOCOMMERCE_SECRET_CORVIN_CASTLE" },
  { name: "HadriansVilla", tour_type: "Hadrian's Villa Tour", api_url: "https://hadrians-villa.it/wp-json/wc/v3", secret_env: "WOOCOMMERCE_SECRET_HADRIANS_VILLA" },
  { name: "PenaPalace", tour_type: "Pena Palace Tour", api_url: "https://penapalace.pt/wp-json/wc/v3", secret_env: "WOOCOMMERCE_SECRET_PENA_PALACE" },
  { name: "VillaEste", tour_type: "Villa d'Este Tour", api_url: "https://villa-d-este.it/wp-json/wc/v3", secret_env: "WOOCOMMERCE_SECRET_VILLA_ESTE" },
  { name: "CasaDiGiulietta", tour_type: "Casa di Giulietta Tour", api_url: "https://casadigiulietta.it/wp-json/wc/v3", secret_env: "WOOCOMMERCE_SECRET_CASA_DI_GIULIETTA" }
];

const getBaseUrl = (apiUrl) => {
    return apiUrl.replace('/wp-json/wc/v3', '');
};

const extractPaymentMethod = (wooOrder) => {
    const method = wooOrder.payment_method || '';
    if (method.includes('stripe') || method.includes('card')) return 'stripe';
    if (method.includes('airwallex')) return 'airwallex';
    if (method.includes('paypal')) return 'paypal';
    return method || null;
};

const extractPaymentData = (wooOrder) => {
    const paymentData = {
        payment_method: extractPaymentMethod(wooOrder),
        payment_transaction_id: wooOrder.transaction_id || null,
        payment_status: null,
        payment_captured: null
    };

    if (wooOrder.status === 'completed') {
        paymentData.payment_status = 'succeeded';
        paymentData.payment_captured = true;
    } else if (wooOrder.status === 'processing') {
        paymentData.payment_status = 'processing';
        paymentData.payment_captured = true;
    } else if (wooOrder.status === 'pending') {
        paymentData.payment_status = 'pending';
        paymentData.payment_captured = false;
    } else if (wooOrder.status === 'failed') {
        paymentData.payment_status = 'failed';
        paymentData.payment_captured = false;
    } else if (wooOrder.status === 'cancelled') {
        paymentData.payment_status = 'canceled';
        paymentData.payment_captured = false;
    } else if (wooOrder.status === 'refunded') {
        paymentData.payment_status = 'refunded';
        paymentData.payment_captured = true;
    }

    return paymentData;
};

const extractTourDate = (wooOrder) => {
    for (const item of (wooOrder.line_items || [])) {
        const dateMeta = (item.meta_data || []).find(m => m.key && m.key.toLowerCase() === 'date');
        if (dateMeta && dateMeta.value) {
            try {
                const parsedDate = new Date(dateMeta.value);
                if (!isNaN(parsedDate.getTime())) {
                    return parsedDate.toISOString().split('T')[0];
                }
            } catch (e) { /* continue */ }
        }
    }

    const allText = [
        wooOrder.customer_note || '',
        ...(wooOrder.line_items || []).flatMap(item => (item.meta_data || []).map(m => m.value || '')),
        ...(wooOrder.meta_data || []).map(m => m.value || '')
    ].join(' ');

    const datePatterns = [
        /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/i,
        /\d{4}-\d{2}-\d{2}/,
        /\d{1,2}\/\d{1,2}\/\d{4}/
    ];

    for (const pattern of datePatterns) {
        const match = allText.match(pattern);
        if (match) {
            try {
                const parsedDate = new Date(match[0]);
                if (!isNaN(parsedDate.getTime())) {
                    return parsedDate.toISOString().split('T')[0];
                }
            } catch (e) { /* continue */ }
        }
    }

    return wooOrder.date_created ? new Date(wooOrder.date_created).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
};

const extractTourTime = (wooOrder) => {
    for (const item of (wooOrder.line_items || [])) {
        const timeMeta = (item.meta_data || []).find(m => m.key && m.key.toLowerCase() === 'time');
        if (timeMeta && timeMeta.value) {
            const timeMatch = timeMeta.value.match(/(\d{1,2}:\d{2}\s*(?:am|pm))/i);
            if (timeMatch) return timeMatch[0];
        }
    }
    return '';
};

const mapOrderStatus = (wooStatus) => {
    if (wooStatus === 'processing') {
        return 'new';
    }
    return wooStatus;
};

Deno.serve(async (req) => {
    try {
        if (req.method !== 'POST') {
            return new Response("Webhook endpoint active. Awaiting POST data.", { status: 200 });
        }

        const url = new URL(req.url);
        const siteIdentifier = url.searchParams.get('site');
        const siteConfig = WOOCOMMERCE_SITES.find(s => s.name === siteIdentifier);

        if (!siteConfig) {
            return new Response(`Site identifier '${siteIdentifier}' not found.`, { status: 400 });
        }

        const secret = Deno.env.get(siteConfig.secret_env);
        if (!secret) {
            return new Response(`Webhook secret for ${siteIdentifier} is not configured.`, { status: 500 });
        }

        const reqClone = req.clone();
        const rawBody = await reqClone.text();
        const signature = req.headers.get('x-wc-webhook-signature');

        if (!signature) {
            return new Response("Missing signature", { status: 401 });
        }

        const hmac = createHmac('sha256', secret);
        const digest = hmac.update(rawBody).digest('base64');

        if (signature !== digest) {
            return new Response("Invalid signature", { status: 401 });
        }

        const wooOrder = JSON.parse(rawBody);

        if (!wooOrder || !wooOrder.id) {
            return new Response("Webhook test successful or invalid data.", { status: 200 });
        }

        const base44 = createClientFromRequest(req);
        const orderId = `${siteConfig.name}-${wooOrder.id}`;
        
        let existingOrders;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                existingOrders = await base44.asServiceRole.entities.Order.filter({ order_id: orderId });
                break;
            } catch (error) {
                retryCount++;
                if (retryCount === maxRetries) throw error;
                await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
            }
        }

        if (existingOrders.length > 0) {
            const orderToUpdate = existingOrders[0];
            const wooMappedStatus = mapOrderStatus(wooOrder.status);
            const paymentData = extractPaymentData(wooOrder);
            
            if (orderToUpdate.status === 'reserved_date' || orderToUpdate.status === 'awaiting_reply') {
                return new Response(`Order ${orderId} has manual status (${orderToUpdate.status}), not updating.`, { status: 200 });
            }
            
            const updateData = { ...paymentData };
            
            if (orderToUpdate.status !== wooMappedStatus) {
                updateData.status = wooMappedStatus;
            }

            if (Object.keys(updateData).length > 0) {
                await base44.asServiceRole.entities.Order.update(orderToUpdate.id, updateData);
                return new Response(`Order ${orderId} updated with status ${wooMappedStatus} and payment data.`, { status: 200 });
            }
            
            return new Response(`Order ${orderId} no changes needed.`, { status: 200 });
        }

        const tickets = [];
        
        (wooOrder.line_items || []).forEach(item => {
            const nameMatch = (item.name || '').match(/\s*x(\d+)$/);
            let quantity;
            let cleanName;
            
            if (nameMatch) {
                quantity = parseInt(nameMatch[1], 10);
                cleanName = (item.name || '').replace(/\s*x\d+$/, '').trim();
            } else {
                quantity = item.quantity || 1;
                cleanName = (item.name || '').trim();
            }
            
            tickets.push({ type: cleanName, quantity: quantity });
        });
        
        const tourDate = extractTourDate(wooOrder);
        const tourTime = extractTourTime(wooOrder);
        const wooMappedStatus = mapOrderStatus(wooOrder.status);
        const paymentData = extractPaymentData(wooOrder);
        
        const transformedOrder = {
            order_id: orderId,
            tour: siteConfig.tour_type,
            tour_date: tourDate,
            tour_time: tourTime,
            tickets,
            extras: [],
            first_name: wooOrder.billing?.first_name || '',
            last_name: wooOrder.billing?.last_name || '',
            email: wooOrder.billing?.email || '',
            phone: wooOrder.billing?.phone || '',
            status: wooMappedStatus,
            priority: 'normal',
            purchase_date: wooOrder.date_created,
            purchase_url: getBaseUrl(siteConfig.api_url),
            fulfilled_by: null,
            venue: `${siteConfig.name} - Main Location`,
            currency: (wooOrder.currency || 'USD').toUpperCase(),
            total_cost: parseFloat(wooOrder.total) || 0,
            projected_profit: parseFloat(wooOrder.total) || 0,
            ...paymentData
        };

        await base44.asServiceRole.entities.Order.create(transformedOrder);
        return new Response(`Order ${orderId} created successfully with status ${wooMappedStatus} and payment data.`, { status: 201 });

    } catch (error) {
        console.error('WEBHOOK ERROR:', error.message, error.stack);
        return new Response(`Server error: ${error.message}`, { status: 500 });
    }
});