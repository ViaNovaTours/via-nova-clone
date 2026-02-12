import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type Payload = {
  prompt?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as Payload;
    const prompt = payload?.prompt?.trim();

    if (!prompt) {
      return jsonResponse(
        { success: false, error: "prompt is required" },
        400
      );
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return jsonResponse(
        { success: false, error: "OPENAI_API_KEY is not configured" },
        500
      );
    }

    const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      return jsonResponse(
        {
          success: false,
          error: "LLM request failed",
          details,
        },
        response.status
      );
    }

    const llmData = await response.json();
    const content = llmData?.choices?.[0]?.message?.content || "";

    return jsonResponse({
      success: true,
      content,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown LLM error",
      },
      500
    );
  }
});

