import { requireAdmin } from "../_shared/auth.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

const PROFIT_PER_TICKET_EURO = 11;

const TOUR_PROFIT_MARGINS: Record<string, number> = {
  "Alcatraz Island Tour": 0.2,
  "Peles Castle Tour": 0.25,
  "Bran Castle Tour": 0.25,
  "Corvin Castle Tour": 0.25,
  "Statue of Liberty Tour": 0.2,
  "Hadrian's Villa Tour": 0.3,
  "Pena Palace Tour": 0.25,
  "Villa d'Este Tour": 0.3,
  "Casa di Giulietta Tour": 0.3,
};

const calculateProfitForOrder = (order: any) => {
  const totalRevenue = Number(order.total_cost || 0);
  if (!totalRevenue) return null;

  const ticketList = Array.isArray(order.tickets) ? order.tickets : [];
  const totalTickets = ticketList.reduce(
    (sum: number, ticket: any) => sum + Number(ticket?.quantity || 0),
    0
  );

  let totalTicketCost = 0;
  let projectedProfit = 0;

  if (totalTickets > 0) {
    const customerPaidPerTicket = totalRevenue / totalTickets;
    const agentCostPerTicket = Math.max(0, customerPaidPerTicket - PROFIT_PER_TICKET_EURO);
    totalTicketCost = agentCostPerTicket * totalTickets;
    projectedProfit = totalRevenue - totalTicketCost;
  } else {
    const margin = TOUR_PROFIT_MARGINS[String(order.tour || "")] ?? 0.25;
    projectedProfit = totalRevenue * margin;
    totalTicketCost = totalRevenue - projectedProfit;
  }

  return {
    total_ticket_cost: totalTicketCost,
    projected_profit: projectedProfit,
  };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin = await requireAdmin(req);
  if (!admin.ok) {
    return admin.response;
  }

  try {
    const { data: allOrders, error } = await supabaseAdmin
      .from("orders")
      .select("id,order_id,tour,status,total_cost,total_ticket_cost,projected_profit,tickets");

    if (error) {
      throw new Error(`Failed to load orders: ${error.message}`);
    }

    const candidates = (allOrders || []).filter((order) => {
      const totalCost = Number(order.total_cost || 0);
      if (totalCost <= 0) return false;
      if (["cancelled", "failed", "refunded"].includes(String(order.status || ""))) {
        return false;
      }

      if (order.projected_profit == null || order.total_ticket_cost == null) {
        return true;
      }

      const margin = Number(order.projected_profit) / totalCost;
      return margin > 0.9;
    });

    const maxOrders = 50;
    const batchSize = 5;
    const betweenUpdates = 100;
    const betweenBatches = 2000;
    const toProcess = candidates.slice(0, maxOrders);

    let updatedCount = 0;
    const errors: string[] = [];

    for (let index = 0; index < toProcess.length; index += 1) {
      const order = toProcess[index];
      try {
        const profitData = calculateProfitForOrder(order);
        if (!profitData) continue;

        const { error: updateError } = await supabaseAdmin
          .from("orders")
          .update(profitData)
          .eq("id", order.id);

        if (updateError) {
          errors.push(`${order.order_id || order.id}: ${updateError.message}`);
        } else {
          updatedCount += 1;
        }

        await sleep(betweenUpdates);
        if ((index + 1) % batchSize === 0 && index < toProcess.length - 1) {
          await sleep(betweenBatches);
        }
      } catch (orderError) {
        errors.push(
          `${order.order_id || order.id}: ${
            orderError instanceof Error ? orderError.message : "Unknown error"
          }`
        );
        await sleep(500);
      }
    }

    return jsonResponse({
      success: true,
      updated_count: updatedCount,
      error_count: errors.length,
      processed_this_run: toProcess.length,
      remaining: Math.max(candidates.length - toProcess.length, 0),
      errors: errors.length ? errors.slice(0, 20) : null,
      note:
        candidates.length > toProcess.length
          ? `Run again to process ${candidates.length - toProcess.length} additional orders.`
          : "All eligible orders processed.",
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown profit calculation error",
      },
      500
    );
  }
});

