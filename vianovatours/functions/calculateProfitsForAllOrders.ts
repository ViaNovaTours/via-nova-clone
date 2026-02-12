import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// Profit margin per ticket in EUR
const PROFIT_PER_TICKET_EURO = 11;

// Fallback profit margins per tour (when tickets can't be extracted properly)
const TOUR_PROFIT_MARGINS = {
  'Alcatraz Island Tour': 0.20,        // 20% margin
  'Peles Castle Tour': 0.25,           // 25% margin
  'Bran Castle Tour': 0.25,            // 25% margin
  'Corvin Castle Tour': 0.25,          // 25% margin
  'Statue of Liberty Tour': 0.20,      // 20% margin
  'Hadrian\'s Villa Tour': 0.30,       // 30% margin
  'Pena Palace Tour': 0.25,            // 25% margin
  'Villa d\'Este Tour': 0.30,          // 30% margin
  'Casa di Giulietta Tour': 0.30       // 30% margin
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const calculateProfitForOrder = (order) => {
  const totalRevenue = order.total_cost || 0;
  
  // Skip if no revenue
  if (totalRevenue === 0) {
    return null;
  }

  // Check if we have valid ticket data
  const hasValidTickets = order.tickets && order.tickets.length > 0;
  const totalTickets = hasValidTickets 
    ? order.tickets.reduce((sum, t) => sum + (t.quantity || 0), 0)
    : 0;

  let totalTicketCost = 0;
  let projectedProfit = 0;

  if (totalTickets > 0) {
    // METHOD 1: Calculate using per-ticket profit margin (€11 per ticket)
    const customerPaidPerTicket = totalRevenue / totalTickets;
    const agentCostPerTicket = Math.max(0, customerPaidPerTicket - PROFIT_PER_TICKET_EURO);
    totalTicketCost = agentCostPerTicket * totalTickets;
    projectedProfit = totalRevenue - totalTicketCost;
  } else {
    // METHOD 2: Fallback to percentage-based margin per tour
    const tourMargin = TOUR_PROFIT_MARGINS[order.tour] || 0.25; // Default 25%
    projectedProfit = totalRevenue * tourMargin;
    totalTicketCost = totalRevenue - projectedProfit;
  }

  return {
    total_ticket_cost: totalTicketCost,
    projected_profit: projectedProfit
  };
};

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

    console.log('Starting profit calculation...');
    
    const allOrders = await base44.asServiceRole.entities.Order.list();
    console.log(`Found ${allOrders.length} total orders`);
    
    // Find orders that need profit calculation
    const ordersNeedingUpdate = allOrders.filter(order => {
      // Skip if no total cost
      if (!order.total_cost || order.total_cost === 0) return false;
      
      // Skip cancelled, failed, refunded orders
      if (order.status === 'cancelled' || order.status === 'failed' || order.status === 'refunded') {
        return false;
      }
      
      // Update if profit data is missing
      if (order.projected_profit == null || order.total_ticket_cost == null) {
        return true;
      }
      
      // Update if margin is suspiciously high (>90% suggests bad data)
      const margin = order.projected_profit / order.total_cost;
      if (margin > 0.90) {
        return true;
      }
      
      return false;
    });

    console.log(`${ordersNeedingUpdate.length} orders need profit calculation`);
    
    const MAX_ORDERS = 50; // Reduced from 200 to avoid rate limits
    const ordersToProcess = ordersNeedingUpdate.slice(0, MAX_ORDERS);
    
    let updatedCount = 0;
    let errorCount = 0;
    const errors = [];

    const BATCH_SIZE = 5;
    const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds
    const DELAY_BETWEEN_UPDATES = 100; // 100ms

    for (let i = 0; i < ordersToProcess.length; i++) {
      const order = ordersToProcess[i];
      
      try {
        const profitData = calculateProfitForOrder(order);
        
        if (profitData) {
          await base44.asServiceRole.entities.Order.update(order.id, profitData);
          updatedCount++;
          
          if (updatedCount % 10 === 0) {
            console.log(`Progress: ${updatedCount}/${ordersToProcess.length} orders updated`);
          }

          // Add delay between each update
          await delay(DELAY_BETWEEN_UPDATES);

          // Add longer delay between batches
          if ((i + 1) % BATCH_SIZE === 0 && i < ordersToProcess.length - 1) {
            console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} complete, pausing...`);
            await delay(DELAY_BETWEEN_BATCHES);
          }
        }
      } catch (error) {
        errorCount++;
        errors.push(`Failed to update ${order.order_id || order.id}: ${error.message}`);
        
        // If rate limit, wait longer before continuing
        if (error.message.includes('Rate limit') || error.message.includes('429')) {
          console.log('Rate limit hit, waiting 5 seconds...');
          await delay(5000);
        }
      }
    }

    const remainingCount = ordersNeedingUpdate.length - ordersToProcess.length;

    return Response.json({
      success: true,
      updated_count: updatedCount,
      error_count: errorCount,
      processed_this_run: ordersToProcess.length,
      remaining: remainingCount,
      errors: errors.length > 0 ? errors.slice(0, 10) : null,
      note: remainingCount > 0 
        ? `Run again to process ${remainingCount} more orders (processing ${MAX_ORDERS} per run to avoid rate limits)` 
        : 'All orders processed!'
    });

  } catch (error) {
    console.error('Profit calculation error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});