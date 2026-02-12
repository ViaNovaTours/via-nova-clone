import { corsHeaders } from "../_shared/cors.ts";

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
    const baseUrl = `https://${hostname}`;
    const robotsTxt = `# robots.txt for ${hostname}
User-agent: *
Allow: /
Disallow: /AdSpend
Disallow: /Calendar
Disallow: /Completed
Disallow: /Costs
Disallow: /Dashboard
Disallow: /ExportOrders
Disallow: /NewOrder
Disallow: /OrderDetail
Disallow: /Profits
Disallow: /TestAdSpend
Disallow: /TourLandingAdmin
Disallow: /TourPreview
Disallow: /TourSetup
Disallow: /Tours
Disallow: /admin
Disallow: /backend

Sitemap: ${baseUrl}/sitemap.xml
Crawl-delay: 1
`;

    return new Response(robotsTxt, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "Unknown robots.txt error",
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      }
    );
  }
});

