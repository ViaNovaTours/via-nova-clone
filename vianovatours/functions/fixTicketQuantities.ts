import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const PROFIT_PER_TICKET_EURO = 11;

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    try {
        const user = await base44.auth.me();
        if (user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - admin only' }, { status: 403 });
        }

        const orders = await base44.asServiceRole.entities.Order.list();
        let fixedCount = 0;
        const fixedOrders = [];

        for (const order of orders) {
            if (!order.tickets || order.tickets.length === 0) continue;
            
            let needsUpdate = false;
            const updatedTickets = order.tickets.map(ticket => {
                let quantity = ticket.quantity || 1;
                let type = ticket.type || '';
                
                // Check for (x2) or x2 pattern in the ticket name
                const parenMatch = type.match(/\(x(\d+)\)/i);
                const endMatch = type.match(/\s+x(\d+)$/i);
                
                if (parenMatch) {
                    const extractedQty = parseInt(parenMatch[1], 10);
                    if (extractedQty !== quantity) {
                        needsUpdate = true;
                        quantity = extractedQty;
                        type = type.replace(/\s*\(x\d+\)/i, '').trim();
                    }
                } else if (endMatch) {
                    const extractedQty = parseInt(endMatch[1], 10);
                    if (extractedQty !== quantity) {
                        needsUpdate = true;
                        quantity = extractedQty;
                        type = type.replace(/\s+x\d+$/i, '').trim();
                    }
                }
                
                return { ...ticket, type, quantity };
            });

            if (needsUpdate) {
                // Recalculate costs and profits
                const totalCost = order.total_cost || 0;
                const totalTickets = updatedTickets.reduce((sum, t) => sum + t.quantity, 0);
                const customerPaidPerTicket = totalTickets > 0 ? totalCost / totalTickets : 0;
                const agentCostPerTicket = Math.max(0, customerPaidPerTicket - PROFIT_PER_TICKET_EURO);
                
                const ticketsWithCosts = updatedTickets.map(ticket => ({
                    ...ticket,
                    cost_per_ticket: agentCostPerTicket
                }));
                
                const totalTicketCost = ticketsWithCosts.reduce((sum, ticket) => 
                    sum + (ticket.cost_per_ticket * ticket.quantity), 0);
                const projectedProfit = totalCost - totalTicketCost;

                await base44.asServiceRole.entities.Order.update(order.id, {
                    tickets: ticketsWithCosts,
                    total_ticket_cost: totalTicketCost,
                    projected_profit: projectedProfit
                });

                fixedCount++;
                fixedOrders.push({
                    order_id: order.order_id,
                    old_tickets: order.tickets,
                    new_tickets: ticketsWithCosts
                });
            }
        }

        return Response.json({
            success: true,
            fixed_count: fixedCount,
            total_orders_checked: orders.length,
            fixed_orders: fixedOrders
        });

    } catch (error) {
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});