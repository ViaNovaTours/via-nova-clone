import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Test 1: Get OAuth access token
        let accessToken;
        try {
            accessToken = await base44.asServiceRole.connectors.getAccessToken("googledrive");
            console.log("✓ Google Drive token obtained");
        } catch (error) {
            return Response.json({ 
                error: 'Failed to get Google Drive token',
                details: error.message
            }, { status: 500 });
        }

        // Test 2: Check if GOOGLE_DRIVE_RECEIPTS_FOLDER_ID is set
        let receiptsFolderId = Deno.env.get("GOOGLE_DRIVE_RECEIPTS_FOLDER_ID");
        if (!receiptsFolderId) {
            return Response.json({ 
                error: 'GOOGLE_DRIVE_RECEIPTS_FOLDER_ID not configured'
            }, { status: 500 });
        }
        console.log("✓ Folder ID found:", receiptsFolderId);

        // Extract folder ID if a full URL was provided
        if (receiptsFolderId.includes('drive.google.com')) {
            const match = receiptsFolderId.match(/folders\/([a-zA-Z0-9_-]+)/);
            if (match) {
                receiptsFolderId = match[1];
                console.log("✓ Extracted folder ID from URL:", receiptsFolderId);
            }
        }

        // Test 3: Try to access the folder
        const folderUrl = `https://www.googleapis.com/drive/v3/files/${receiptsFolderId}?fields=id,name,mimeType`;
        const folderResponse = await fetch(folderUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!folderResponse.ok) {
            const errorData = await folderResponse.json();
            return Response.json({ 
                error: 'Cannot access Google Drive folder',
                details: errorData,
                folderId: receiptsFolderId
            }, { status: 500 });
        }

        const folderData = await folderResponse.json();
        console.log("✓ Folder accessible:", folderData);

        return Response.json({
            success: true,
            message: 'Google Drive integration is working correctly',
            folderName: folderData.name,
            folderId: receiptsFolderId
        });

    } catch (error) {
        console.error("Test error:", error);
        return Response.json({ 
            error: error.message,
            details: error.toString()
        }, { status: 500 });
    }
});