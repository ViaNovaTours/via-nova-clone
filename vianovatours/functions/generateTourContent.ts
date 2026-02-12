import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { tour_name } = await req.json();

        if (!tour_name) {
            return Response.json({ error: 'Tour name is required' }, { status: 400 });
        }

        // Generate comprehensive tour content using AI with internet research
        const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `Research and generate comprehensive content for "${tour_name}" tour/attraction landing page.

CRITICAL FORMATTING RULES:

1. Hero section:
   - hero_title: ONLY the attraction name, nothing else (e.g., "Montjuïc Castle", "Eiffel Tower", "Colosseum")
   - hero_subtitle: The attraction name in its native language (e.g., "Castell Montjuïc" for Montjuïc Castle, "La Tour Eiffel" for Eiffel Tower)

2. Description: Write a simple 2-3 paragraph description of the attraction. NO MARKDOWN FORMATTING. No headers, no bullet points, no bold text. Just plain paragraphs describing the attraction, its history, and what visitors can experience.

3. Highlights: 6-8 short phrases without any special formatting (e.g., "Skip-the-line access", "Expert audio guide", "Panoramic views"). Do NOT use asterisks or any markdown.

4. FAQs: 5-7 questions with detailed answers about booking, entry, timing, etc.

5. Timezone: Provide the correct timezone for the attraction's location (e.g., "Europe/Madrid" for Barcelona, "America/New_York" for New York, "Europe/Rome" for Rome)

6. Location Address: Provide the complete physical address of the attraction including street, city, postal code, and country (e.g., "Carretera de Montjuïc, 66, 08038 Barcelona, Spain")

Research current, accurate information about the attraction. Make content engaging and conversion-focused.`,
            add_context_from_internet: true,
            response_json_schema: {
                type: "object",
                properties: {
                    hero_title: { type: "string" },
                    hero_subtitle: { type: "string" },
                    description: { type: "string" },
                    timezone: { type: "string" },
                    location_address: { type: "string" },
                    highlights: {
                        type: "array",
                        items: { type: "string" }
                    },
                    faqs: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                question: { type: "string" },
                                answer: { type: "string" }
                            }
                        }
                    }
                }
            }
        });

        return Response.json({
            success: true,
            content: response
        });

    } catch (error) {
        console.error('Tour content generation error:', error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});