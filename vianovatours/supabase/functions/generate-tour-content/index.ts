import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type Payload = {
  tour_name?: string;
};

const fallbackContent = (tourName: string) => ({
  hero_title: tourName,
  hero_subtitle: `${tourName} Tickets`,
  description: `${tourName} is one of the most visited attractions in the area. Book your tickets in advance to avoid sold-out dates and enjoy a smooth entry experience.\n\nThis page helps travelers quickly choose a date, pick ticket types, and confirm their booking with secure checkout.`,
  timezone: "Europe/Rome",
  location_address: "",
  highlights: [
    "Instant mobile confirmation",
    "Simple online checkout",
    "Secure payment",
    "Flexible ticket options",
    "Trusted support",
  ],
  faqs: [
    {
      question: "Do I need to print my ticket?",
      answer: "Most venues accept mobile tickets, but check your confirmation email for specific instructions.",
    },
    {
      question: "Can I cancel my booking?",
      answer: "Cancellation terms vary by tour. Review the terms before checkout.",
    },
    {
      question: "How early should I arrive?",
      answer: "Arriving 15-20 minutes early is recommended to avoid delays.",
    },
  ],
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as Payload;
    const tourName = payload?.tour_name?.trim();

    if (!tourName) {
      return jsonResponse(
        {
          success: false,
          error: "tour_name is required",
        },
        400
      );
    }

    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiApiKey) {
      return jsonResponse({
        success: true,
        content: fallbackContent(tourName),
      });
    }

    const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You generate conversion-focused attraction page content in JSON only.",
          },
          {
            role: "user",
            content: `Generate landing page content for "${tourName}".
Return JSON with this shape:
{
  "hero_title": "string",
  "hero_subtitle": "string",
  "description": "string (2-3 short paragraphs, no markdown)",
  "timezone": "IANA timezone string",
  "location_address": "full street address",
  "highlights": ["string", "..."],
  "faqs": [{"question":"string","answer":"string"}]
}`,
          },
        ],
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
    const contentText = llmData?.choices?.[0]?.message?.content;
    const parsedContent = JSON.parse(contentText);

    return jsonResponse({
      success: true,
      content: parsedContent,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown generation error",
      },
      500
    );
  }
});

