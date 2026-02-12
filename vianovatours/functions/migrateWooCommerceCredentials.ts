import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// All site configurations that should be migrated
const WOOCOMMERCE_SITES = [
    { site_name: "AlcatrazTourism", tour_name: "Alcatraz Island Tour", api_url: "https://alcatraztourism.com/wp-json/wc/v3", website_url: "https://alcatraztourism.com", key_env: "WOOCOMMERCE_KEY_ALCATRAZ_TOURISM", secret_env: "WOOCOMMERCE_SECRET_ALCATRAZ_TOURISM", profit_margin: 0.20 },
    { site_name: "PelesCastle", tour_name: "Peles Castle Tour", api_url: "https://pelescastle.ro/wp-json/wc/v3", website_url: "https://pelescastle.ro", key_env: "WOOCOMMERCE_KEY_PELES_CASTLE", secret_env: "WOOCOMMERCE_SECRET_PELES_CASTLE", profit_margin: 0.25 },
    { site_name: "BranCastle", tour_name: "Bran Castle Tour", api_url: "https://brancastletickets.ro/wp-json/wc/v3", website_url: "https://brancastletickets.ro", key_env: "WOOCOMMERCE_KEY_BRAN_CASTLE", secret_env: "WOOCOMMERCE_SECRET_BRAN_CASTLE", profit_margin: 0.25 },
    { site_name: "StatueofLiberty", tour_name: "Statue of Liberty Tour", api_url: "https://statueoflibertytickets.org/wp-json/wc/v3", website_url: "https://statueoflibertytickets.org", key_env: "WOOCOMMERCE_KEY_STATUE_LIBERTY", secret_env: "WOOCOMMERCE_SECRET_STATUE_LIBERTY", profit_margin: 0.20 },
    { site_name: "CorvinCastle", tour_name: "Corvin Castle Tour", api_url: "https://corvincastle.ro/wp-json/wc/v3", website_url: "https://corvincastle.ro", key_env: "WOOCOMMERCE_KEY_CORVIN_CASTLE", secret_env: "WOOCOMMERCE_SECRET_CORVIN_CASTLE", profit_margin: 0.25 },
    { site_name: "HadriansVilla", tour_name: "Hadrian's Villa Tour", api_url: "https://hadrians-villa.it/wp-json/wc/v3", website_url: "https://hadrians-villa.it", key_env: "WOOCOMMERCE_KEY_HADRIANS_VILLA", secret_env: "WOOCOMMERCE_SECRET_HADRIANS_VILLA", profit_margin: 0.30 },
    { site_name: "PenaPalace", tour_name: "Pena Palace Tour", api_url: "https://penapalace.pt/wp-json/wc/v3", website_url: "https://penapalace.pt", key_env: "WOOCOMMERCE_KEY_PENA_PALACE", secret_env: "WOOCOMMERCE_SECRET_PENA_PALACE", profit_margin: 0.25 },
    { site_name: "VillaEste", tour_name: "Villa d'Este Tour", api_url: "https://villa-d-este.it/wp-json/wc/v3", website_url: "https://villa-d-este.it", key_env: "WOOCOMMERCE_KEY_VILLA_ESTE", secret_env: "WOOCOMMERCE_SECRET_VILLA_ESTE", profit_margin: 0.30 },
    { site_name: "CasaDiGiulietta", tour_name: "Casa di Giulietta Tour", api_url: "https://casadigiulietta.it/wp-json/wc/v3", website_url: "https://casadigiulietta.it", key_env: "WOOCOMMERCE_KEY_CASA_DI_GIULIETTA", secret_env: "WOOCOMMERCE_SECRET_CASA_DI_GIULIETTA", profit_margin: 0.30 }
];

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

        console.log('Starting migration of WooCommerce credentials...');
        
        let imported = 0;
        let skipped = 0;
        let errors = [];

        for (const site of WOOCOMMERCE_SITES) {
            try {
                if (!site || !site.site_name || !site.key_env || !site.secret_env) {
                    console.log(`Skipping invalid site configuration`);
                    skipped++;
                    continue;
                }

                const consumerKey = Deno.env.get(site.key_env);
                const consumerSecret = Deno.env.get(site.secret_env);

                if (!consumerKey || !consumerSecret) {
                    console.log(`Skipping ${site.site_name} - credentials not found in environment`);
                    skipped++;
                    continue;
                }

                // Check if already exists
                const existing = await base44.asServiceRole.entities.WooCommerceCredentials.filter({ 
                    site_name: site.site_name 
                });

                if (existing.length > 0) {
                    console.log(`Skipping ${site.site_name} - already exists in database`);
                    skipped++;
                    continue;
                }

                // Create new credential record
                await base44.asServiceRole.entities.WooCommerceCredentials.create({
                    site_name: site.site_name,
                    tour_name: site.tour_name,
                    website_url: site.website_url,
                    api_url: site.api_url,
                    consumer_key: consumerKey,
                    consumer_secret: consumerSecret,
                    profit_margin: site.profit_margin,
                    is_active: true
                });

                console.log(`✓ Imported ${site.site_name}`);
                imported++;

            } catch (error) {
                errors.push(`Failed to import ${site.site_name}: ${error.message}`);
                console.error(`Error importing ${site.site_name}:`, error);
            }
        }

        return Response.json({
            success: true,
            imported,
            skipped,
            total_sites: WOOCOMMERCE_SITES.length,
            errors: errors.length > 0 ? errors : null,
            message: imported > 0 
                ? `Successfully migrated ${imported} tour(s) from environment variables to database!` 
                : 'All tours were already in the database or credentials not found.'
        });

    } catch (error) {
        console.error('Migration error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});