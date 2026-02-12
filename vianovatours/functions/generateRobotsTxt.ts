import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const hostname = url.searchParams.get('domain') || url.hostname;
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

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml

# Crawl-delay (optional, be nice to servers)
Crawl-delay: 1
`;

    return new Response(robotsTxt, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch (error) {
    console.error('Robots.txt generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});