import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type AdSpendPayload = {
  date?: string;
  tour_name?: string;
  tour?: string;
  source?: string;
  cost?: number | string;
  currency?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-webhook-secret, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const normalizeDate = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const parseSecret = (req: Request) => {
  const explicit = req.headers.get("x-webhook-secret") || "";
  if (explicit) return explicit.trim();

  const authorization = req.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() === "bearer" && token) {
    return token.trim();
  }
  return "";
};

const normalizeRecord = (input: AdSpendPayload) => {
  const date = normalizeDate(String(input?.date || ""));
  const tourName = String(input?.tour_name || input?.tour || "").trim();
  const source = String(input?.source || "unknown").trim() || "unknown";
  const cost = Number(input?.cost ?? 0);
  const currency = String(input?.currency || "USD").trim().toUpperCase() || "USD";

  if (!date || !tourName || !Number.isFinite(cost)) {
    return null;
  }

  return {
    date,
    tour_name: tourName,
    source,
    cost,
    currency,
  };
};

const upsertOne = async (record: {
  date: string;
  tour_name: string;
  source: string;
  cost: number;
  currency: string;
}) => {
  const { data: existing, error: existingError } = await supabase
    .from("ad_spend")
    .select("id")
    .eq("date", record.date)
    .eq("tour_name", record.tour_name)
    .eq("source", record.source)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("ad_spend")
      .update({
        cost: record.cost,
        currency: record.currency,
      })
      .eq("id", existing.id);
    if (updateError) {
      throw new Error(updateError.message);
    }
    return { action: "updated", id: existing.id };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("ad_spend")
    .insert(record)
    .select("id")
    .single();
  if (insertError) {
    throw new Error(insertError.message);
  }
  return { action: "created", id: inserted.id };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { success: false, error: "Method not allowed. Use POST." },
      405
    );
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { success: false, error: "Missing Supabase service role configuration" },
      500
    );
  }

  const requiredSecret = Deno.env.get("LOG_AD_SPEND_WEBHOOK_SECRET");
  if (!requiredSecret) {
    return jsonResponse(
      {
        success: false,
        error: "LOG_AD_SPEND_WEBHOOK_SECRET is not configured",
      },
      500
    );
  }

  const providedSecret = parseSecret(req);
  if (!providedSecret || providedSecret !== requiredSecret) {
    return jsonResponse(
      { success: false, error: "Unauthorized webhook request" },
      401
    );
  }

  try {
    const body = await req.json();
    const records = Array.isArray(body) ? body : [body];

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const raw of records) {
      const normalized = normalizeRecord(raw as AdSpendPayload);
      if (!normalized) {
        errors.push("Invalid payload record (date/tour_name/cost required)");
        continue;
      }

      try {
        const result = await upsertOne(normalized);
        if (result.action === "created") {
          created += 1;
        } else {
          updated += 1;
        }
      } catch (rowError) {
        errors.push(
          rowError instanceof Error ? rowError.message : "Unknown row processing error"
        );
      }
    }

    return jsonResponse({
      success: errors.length === 0,
      created,
      updated,
      processed: records.length,
      errors: errors.length ? errors : null,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown log-ad-spend error",
      },
      500
    );
  }
});

