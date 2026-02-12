import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { to, subject, html, text } = await req.json();

        if (!to || !subject || (!html && !text)) {
            return Response.json({ 
                error: 'Missing required fields: to, subject, and either html or text' 
            }, { status: 400 });
        }

        const apiKey = Deno.env.get('SENDGRID_API_KEY');
        if (!apiKey) {
            return Response.json({ error: 'SendGrid API key not configured' }, { status: 500 });
        }

        const emailData = {
            personalizations: [{
                to: [{ email: to }]
            }],
            from: {
                email: 'info@vianovatours.com',
                name: 'Via Nova Tours'
            },
            subject: subject,
            content: []
        };

        if (text) {
            emailData.content.push({
                type: 'text/plain',
                value: text
            });
        }

        if (html) {
            emailData.content.push({
                type: 'text/html',
                value: html
            });
        }

        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(emailData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('SendGrid error:', errorText);
            return Response.json({ 
                error: 'Failed to send email',
                details: errorText
            }, { status: response.status });
        }

        return Response.json({ 
            success: true,
            message: 'Email sent successfully'
        });

    } catch (error) {
        console.error('Error sending email:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});