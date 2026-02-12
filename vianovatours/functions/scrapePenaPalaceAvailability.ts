import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const CONFIG = {
    EVENT_ID: 263,
    PRODUCT_URL: 'https://bilheteira.parquesdesintra.pt/evento/parque-e-palacio-nacional-da-pena/263/pt',
    TIMESLOT_API: 'https://bilheteira.parquesdesintra.pt/ajax/multixop/produtobilhete_actions',
    DAYS_AHEAD: 14,
    SOURCE: 'pena-palace'
};

const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

const formatISODate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
};

Deno.serve(async (req) => {
    try {
        console.log('=== Pena Palace Scraper Starting ===');
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ 
                success: false,
                error: 'Unauthorized - admin only' 
            }, { status: 401 });
        }

        // Get session cookie
        console.log('Getting session...');
        const pageResponse = await fetch(CONFIG.PRODUCT_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'max-age=0'
            }
        });

        const cookies = [];
        if (typeof pageResponse.headers.getSetCookie === 'function') {
            const setCookies = pageResponse.headers.getSetCookie();
            for (const cookie of setCookies) {
                cookies.push(cookie.split(';')[0]);
            }
        }
        
        const cookieString = cookies.join('; ');
        console.log(`Session: ${cookieString}`);

        // Generate dates
        const dates = [];
        const today = new Date();
        for (let i = 0; i < CONFIG.DAYS_AHEAD; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            dates.push(date);
        }
        
        const allSlots = [];
        let successCount = 0;

        for (const date of dates) {
            const dateStr = formatDate(date);
            const isoDateStr = formatISODate(date);
            
            try {
                await new Promise(resolve => setTimeout(resolve, 800));
                
                const url = new URL(CONFIG.TIMESLOT_API);
                url.searchParams.set('action', 'getRefreshTimeslots');
                url.searchParams.set('idEvento', CONFIG.EVENT_ID);
                url.searchParams.set('dtSlot', dateStr);
                url.searchParams.set('useTimeSlots', 'True');
                url.searchParams.set('abateLotacao', 'True');
                url.searchParams.set('_', Date.now());
                
                const response = await fetch(url.toString(), {
                    headers: {
                        'Cookie': cookieString,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/json, text/javascript, */*; q=0.01',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Referer': CONFIG.PRODUCT_URL,
                        'Origin': 'https://bilheteira.parquesdesintra.pt',
                        'Connection': 'keep-alive',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-origin'
                    }
                });
                
                const data = await response.json();
                
                if (data.error === 'reload' || data.result === '-1' || !data.htmlListTimeSlots) {
                    continue;
                }
                
                // Parse HTML
                const optionRegex = /<option[^>]*value=["'](\d+)["'][^>]*>(.*?)<\/option>/gs;
                let match;
                
                while ((match = optionRegex.exec(data.htmlListTimeSlots)) !== null) {
                    const value = match[1];
                    const content = match[2];
                    
                    if (value === '0') continue;
                    
                    const timeslotId = parseInt(value, 10);
                    const disabled = match[0].includes('disabled');
                    
                    const timeMatch = content.match(/(\d{1,2}:\d{2})/);
                    const time = timeMatch ? timeMatch[1] : null;
                    
                    let available = 0;
                    const availMatch = content.match(/Bilhetes disponíveis:\s*(\d+)/i);
                    if (availMatch) available = parseInt(availMatch[1], 10);
                    
                    if (time) {
                        allSlots.push({
                            source: CONFIG.SOURCE,
                            event_id: CONFIG.EVENT_ID,
                            date: isoDateStr,
                            time,
                            timeslot_id: timeslotId,
                            available,
                            disabled,
                            scraped_at: new Date().toISOString()
                        });
                    }
                }
                
                successCount++;
            } catch (error) {
                console.error(`Error ${dateStr}:`, error.message);
            }
        }

        console.log(`Found ${allSlots.length} slots from ${successCount} dates`);

        // Store in database
        if (allSlots.length > 0) {
            const existingSlots = await base44.asServiceRole.entities.TimeslotAvailability.filter({
                source: CONFIG.SOURCE
            });
            
            const scrapedDates = new Set(allSlots.map(s => s.date));
            const toDelete = existingSlots.filter(slot => scrapedDates.has(slot.date));

            for (const slot of toDelete) {
                await base44.asServiceRole.entities.TimeslotAvailability.delete(slot.id);
            }
            
            await base44.asServiceRole.entities.TimeslotAvailability.bulkCreate(allSlots);
        }

        return Response.json({
            success: true,
            dates_checked: dates.length,
            dates_successful: successCount,
            total_slots_found: allSlots.length
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});