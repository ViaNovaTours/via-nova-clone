Deno.serve(async (req) => {
    try {
        const publishableKey = Deno.env.get('STRIPE_PUBLISHABLE_KEY');
        
        if (!publishableKey) {
            return Response.json({ 
                error: 'Stripe publishable key not configured' 
            }, { status: 500 });
        }

        return Response.json({ 
            publishable_key: publishableKey 
        });
    } catch (error) {
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});