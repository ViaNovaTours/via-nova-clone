import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import Stripe from "npm:stripe@17.5.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type TicketItem = {
  ticket_type_id?: string;
  type: string;
  quantity: number;
  price: number;
};

type BookingPayload = {
  tour_name: string;
  date: string;
  time: string;
  tickets: TicketItem[];
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    state_region?: string;
    zip?: string;
    country?: string;
  };
  total: number;
  currency: string;
  payment_method_id: string;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const stripe = new Stripe(stripeSecret);

const parseOrderNumber = (orderId?: string | null) => {
  if (!orderId) return 0;
  const match = orderId.match(/Order (\d+)$/);
  if (!match) return 0;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { success: false, error: "Missing Supabase service role configuration" },
      500
    );
  }

  if (!stripeSecret) {
    return jsonResponse(
      { success: false, error: "STRIPE_SECRET_KEY is not configured" },
      500
    );
  }

  try {
    const bookingData = (await req.json()) as BookingPayload;

    if (
      !bookingData?.tour_name ||
      !bookingData?.customer?.email ||
      !bookingData?.payment_method_id
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "Missing required booking fields: tour_name, customer.email, payment_method_id",
        },
        400
      );
    }

    const { data: existingOrders, error: ordersError } = await supabase
      .from("orders")
      .select("order_id")
      .not("order_id", "is", null)
      .limit(5000);

    if (ordersError) {
      throw new Error(`Failed to read orders: ${ordersError.message}`);
    }

    const highestOrderNumber = (existingOrders ?? []).reduce(
      (highest, row) => Math.max(highest, parseOrderNumber(row.order_id)),
      999
    );

    const nextOrderNumber = highestOrderNumber + 1;
    const orderId = `${bookingData.tour_name} | Online Tickets - Order ${nextOrderNumber}`;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round((bookingData.total || 0) * 100),
      currency: (bookingData.currency || "usd").toLowerCase(),
      payment_method: bookingData.payment_method_id,
      confirm: true,
      description: orderId,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
    });

    if (paymentIntent.status !== "succeeded") {
      return jsonResponse(
        {
          success: false,
          error: "Payment did not succeed",
        },
        402
      );
    }

    const orderPayload = {
      order_id: orderId,
      tour: bookingData.tour_name,
      tour_date: bookingData.date || null,
      tour_time: bookingData.time || null,
      tickets: bookingData.tickets || [],
      extras: [],
      first_name: bookingData.customer.firstName || "",
      last_name: bookingData.customer.lastName || "",
      email: bookingData.customer.email || "",
      phone: bookingData.customer.phone || "",
      address: bookingData.customer.address || "",
      city: bookingData.customer.city || "",
      state_region:
        bookingData.customer.state_region || bookingData.customer.state || "",
      zip: bookingData.customer.zip || "",
      country: bookingData.customer.country || "",
      status: "unprocessed",
      priority: "normal",
      purchase_date: new Date().toISOString(),
      currency: bookingData.currency || "USD",
      total_cost: bookingData.total || 0,
      payment_method: "stripe",
      payment_status: paymentIntent.status,
      payment_captured: true,
      payment_transaction_id: paymentIntent.id,
      payment_customer_id:
        typeof paymentIntent.customer === "string"
          ? paymentIntent.customer
          : null,
      payment_fee: 0,
      payment_net_amount: bookingData.total || 0,
      purchase_url: `Landing Page - ${bookingData.tour_name}`,
    };

    const { data: createdOrder, error: createError } = await supabase
      .from("orders")
      .insert(orderPayload)
      .select("id,order_id")
      .single();

    if (createError) {
      throw new Error(`Failed to create order: ${createError.message}`);
    }

    return jsonResponse({
      success: true,
      order_id: createdOrder.order_id,
      order_uuid: createdOrder.id,
      message: "Booking confirmed successfully",
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown booking error",
      },
      500
    );
  }
});

