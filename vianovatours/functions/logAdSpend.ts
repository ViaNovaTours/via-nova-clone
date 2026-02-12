import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// This function receives daily ad spend data from a service like Make.com
// and logs it into the AdSpend entity.

Deno.serve(async (req) => {
    const startTime = Date.now();
    console.log('════════════════════════════════════════════════════');
    console.log('📊 NEW AD SPEND WEBHOOK REQUEST RECEIVED');
    console.log('Timestamp:', new Date().toISOString());
    console.log('════════════════════════════════════════════════════');
    
    // Log ALL request details
    console.log('🔍 REQUEST DETAILS:');
    console.log('  Method:', req.method);
    console.log('  URL:', req.url);
    
    // Log ALL headers (including what we're looking for)
    const allHeaders = {};
    req.headers.forEach((value, key) => {
        allHeaders[key] = value;
    });
    console.log('  Headers:', JSON.stringify(allHeaders, null, 2));
    
    // Specifically check Authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('\n🔑 AUTHORIZATION CHECK:');
    console.log('  Received Authorization header:', authHeader ? `"${authHeader}"` : 'NULL/MISSING');
    console.log('  Header length:', authHeader ? authHeader.length : 0);
    
    // Get expected secret
    const secretKey = Deno.env.get('AD_SPEND_WEBHOOK_SECRET');
    console.log('  Expected secret from env:', secretKey ? `"${secretKey}"` : 'NOT SET IN ENV');
    console.log('  Expected full header:', secretKey ? `"Bearer ${secretKey}"` : 'N/A');
    console.log('  Match:', authHeader === `Bearer ${secretKey}` ? '✅ YES' : '❌ NO');
    
    if (!secretKey) {
        console.error('\n❌ CRITICAL ERROR: AD_SPEND_WEBHOOK_SECRET not configured in environment');
        return new Response(JSON.stringify({ 
            error: "Server error: Webhook secret is not configured.",
            debug_info: "AD_SPEND_WEBHOOK_SECRET environment variable is missing"
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    if (!authHeader || authHeader !== `Bearer ${secretKey}`) {
        console.error('\n❌ AUTHORIZATION FAILED:');
        console.error('  Expected:', `Bearer ${secretKey}`);
        console.error('  Received:', authHeader || 'NULL');
        console.error('  Comparison result: MISMATCH');
        
        return new Response(JSON.stringify({ 
            error: "Unauthorized. Missing or invalid Authorization header.",
            debug_info: {
                received_header: authHeader || null,
                expected_format: "Bearer <secret>",
                header_present: !!authHeader,
                comparison_failed: true
            }
        }), { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    console.log('\n✅ Authorization passed!');
    
    if (req.method !== 'POST') {
        console.error('\n❌ Invalid method:', req.method, '(expected POST)');
        return new Response(JSON.stringify({ 
            error: "This endpoint only accepts POST requests.",
            debug_info: { method_received: req.method }
        }), { 
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const rawBody = await req.text();
        console.log('\n📦 RAW REQUEST BODY:');
        console.log(rawBody);
        
        let payload;
        try {
            payload = JSON.parse(rawBody);
            console.log('\n📦 PARSED PAYLOAD:');
            console.log(JSON.stringify(payload, null, 2));
        } catch (parseError) {
            console.error('\n❌ JSON PARSE ERROR:', parseError.message);
            return new Response(JSON.stringify({ 
                error: "Invalid JSON in request body",
                debug_info: { parse_error: parseError.message, raw_body: rawBody }
            }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // The payload can be a single object or an array of objects
        const records = Array.isArray(payload) ? payload : [payload];
        
        if (records.length === 0) {
            console.error('\n❌ Empty request body');
            return new Response(JSON.stringify({ 
                error: "Request body is empty."
            }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log(`\n🔄 Processing ${records.length} record(s)...`);
        
        const base44 = createClientFromRequest(req);
        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        const processedRecords = [];

        for (const record of records) {
            let { date, tour_name, cost, currency } = record;
            
            console.log(`\n📝 Processing record:`, record);
            
            if (!date || !tour_name || cost == null) {
                console.warn('⚠️ SKIPPED - Missing required fields:', { date, tour_name, cost });
                skippedCount++;
                continue;
            }

            // Automatically convert Google Ads micros format (if cost > 10000)
            const originalCost = cost;
            if (cost > 10000) {
                cost = cost / 1000000;
                console.log(`🔄 Converted cost from micros: ${originalCost} → ${cost}`);
            }

            console.log(`💰 Processing: ${tour_name} on ${date} = ${cost} ${currency || 'EUR'}`);

            // Check for an existing record for this tour on this date to prevent duplicates
            const existing = await base44.asServiceRole.entities.AdSpend.filter({
                date: date,
                tour_name: tour_name
            });

            if (existing.length > 0) {
                console.log(`📝 Found existing record (ID: ${existing[0].id}), updating...`);
                await base44.asServiceRole.entities.AdSpend.update(existing[0].id, { 
                    cost, 
                    currency: currency || 'EUR' 
                });
                updatedCount++;
                processedRecords.push({ tour_name, date, action: 'updated' });
                console.log(`✅ Updated existing record for ${tour_name}`);
            } else {
                console.log(`➕ No existing record found, creating new...`);
                await base44.asServiceRole.entities.AdSpend.create({ 
                    date, 
                    tour_name, 
                    cost, 
                    currency: currency || 'EUR' 
                });
                createdCount++;
                processedRecords.push({ tour_name, date, action: 'created' });
                console.log(`✅ Created new record for ${tour_name}`);
            }
        }

        const duration = Date.now() - startTime;
        const responseMessage = {
            success: true,
            message: `Ad spend logged successfully`,
            created: createdCount,
            updated: updatedCount,
            skipped: skippedCount,
            total_processed: records.length,
            processed_records: processedRecords,
            execution_time_ms: duration
        };

        console.log('\n════════════════════════════════════════════════════');
        console.log('🎉 SUCCESS:', JSON.stringify(responseMessage, null, 2));
        console.log('⏱️  Total execution time:', duration, 'ms');
        console.log('════════════════════════════════════════════════════\n');
        
        return new Response(JSON.stringify(responseMessage), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error('\n════════════════════════════════════════════════════');
        console.error("❌ ERROR PROCESSING WEBHOOK:");
        console.error("Message:", error.message);
        console.error("Stack trace:", error.stack);
        console.error('⏱️  Time before error:', duration, 'ms');
        console.error('════════════════════════════════════════════════════\n');
        
        return new Response(JSON.stringify({ 
            error: `Internal Server Error: ${error.message}`,
            debug_info: {
                error_type: error.name,
                stack_preview: error.stack?.split('\n').slice(0, 3),
                execution_time_ms: duration
            }
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});