import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerEmail } = await req.json();
    
    if (!customerEmail) {
      return Response.json({ error: 'Customer email required' }, { status: 400 });
    }

    // Get Gmail access token
    const accessToken = await base44.asServiceRole.connectors.getAccessToken("gmail");

    // Search for all messages with this email address
    const searchQuery = encodeURIComponent(`from:${customerEmail} OR to:${customerEmail}`);
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${searchQuery}&maxResults=50`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Gmail search error:', errorText);
      return Response.json({ error: 'Failed to search Gmail', details: errorText }, { status: 500 });
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.messages || searchData.messages.length === 0) {
      return Response.json({ threads: [] });
    }

    // Fetch details for each message
    const messages = await Promise.all(
      searchData.messages.slice(0, 20).map(async (msg) => {
        const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`;
        const msgResponse = await fetch(msgUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (!msgResponse.ok) return null;
        
        const msgData = await msgResponse.json();
        
        // Parse headers
        const headers = msgData.payload.headers;
        const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
        
        // Get message body
        let body = '';
        if (msgData.payload.body?.data) {
          body = atob(msgData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } else if (msgData.payload.parts) {
          // Find text/plain or text/html part
          const textPart = msgData.payload.parts.find(p => p.mimeType === 'text/plain' || p.mimeType === 'text/html');
          if (textPart?.body?.data) {
            body = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          }
        }
        
        // Strip HTML tags if it's HTML
        if (body.includes('<html') || body.includes('<div')) {
          body = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }
        
        // Truncate long messages
        if (body.length > 500) {
          body = body.substring(0, 500) + '...';
        }
        
        return {
          id: msgData.id,
          threadId: msgData.threadId,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          to: getHeader('To'),
          date: new Date(parseInt(msgData.internalDate)).toISOString(),
          snippet: msgData.snippet,
          body: body.substring(0, 500)
        };
      })
    );

    // Filter out null results and sort by date
    const validMessages = messages.filter(m => m !== null).sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );

    return Response.json({ threads: validMessages });

  } catch (error) {
    console.error('Fetch Gmail threads error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});