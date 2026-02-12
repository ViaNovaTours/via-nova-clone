import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

const getHostname = (req: Request) => {
  const url = new URL(req.url);
  const queryDomain = url.searchParams.get("domain");
  if (queryDomain) return queryDomain;

  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) return forwardedHost.split(",")[0].trim();

  return url.hostname;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const hostname = getHostname(req);
    const { data: tourPages, error } = await supabaseAdmin
      .from("tour_landing_pages")
      .select("id")
      .eq("domain", hostname)
      .eq("is_active", true)
      .limit(1);

    if (error) {
      return new Response(`Failed to read tour pages: ${error.message}`, {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    if (!tourPages || tourPages.length === 0) {
      return new Response("No tour found for this domain", {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const baseUrl = `https://${hostname}`;
    const currentDate = new Date().toISOString().split("T")[0];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/about</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/contact</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/privacy-policy</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${baseUrl}/terms-and-conditions</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${baseUrl}/refund-policy</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>`;

    return new Response(sitemap, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "Unknown sitemap error",
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      }
    );
  }
});

