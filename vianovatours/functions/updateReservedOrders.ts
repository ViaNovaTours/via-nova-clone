import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve((req) => {
    try {
        // This function is now deprecated - reserved_date is manual only
        return Response.json({
            success: true,
            message: "Reserved date logic has been removed. Status is now manual-only.",
            deprecated: true
        });
    } catch (error) {
        console.error('Error:', error.message);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});