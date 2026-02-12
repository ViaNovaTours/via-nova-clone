import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        let { fileData, fileName, fileType, tourName, orderId, firstName, lastName } = body;

        if (!fileData || !fileName || !tourName) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Convert base64 to bytes (rasterization is now done in browser)
        const fileBytes = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));

        // Get OAuth access token
        const accessToken = await base44.asServiceRole.connectors.getAccessToken("googledrive");

        // Get the receipts folder ID from secrets
        let receiptsFolderId = Deno.env.get("GOOGLE_DRIVE_RECEIPTS_FOLDER_ID");
        if (!receiptsFolderId) {
            return Response.json({ error: 'GOOGLE_DRIVE_RECEIPTS_FOLDER_ID not configured' }, { status: 500 });
        }

        // Extract folder ID if a full URL was provided
        if (receiptsFolderId.includes('drive.google.com')) {
            const match = receiptsFolderId.match(/folders\/([a-zA-Z0-9_-]+)/);
            if (match) {
                receiptsFolderId = match[1];
            }
        }

        // Search for tour folder or create it
        // Escape single quotes in tour name for query
        const escapedTourName = tourName.replace(/'/g, "\\'");
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${escapedTourName}' and '${receiptsFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)&orderBy=createdTime desc`;
        
        const searchResponse = await fetch(searchUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!searchResponse.ok) {
            const errorData = await searchResponse.json();
            console.error("Search folder error:", errorData);
            return Response.json({ 
                error: 'Failed to search for tour folder',
                details: errorData
            }, { status: 500 });
        }

        const searchData = await searchResponse.json();
        console.log("Search result for tour folder:", searchData);
        
        let tourFolderId;
        if (searchData.files && searchData.files.length > 0) {
            // Folder exists - use the most recently created one
            tourFolderId = searchData.files[0].id;
            console.log("Found existing folder:", tourFolderId, tourName);
        } else {
            // Create tour folder
            console.log("Creating new folder:", tourName);
            const createFolderResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: tourName,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [receiptsFolderId]
                })
            });

            if (!createFolderResponse.ok) {
                const errorData = await createFolderResponse.json();
                console.error("Create folder error:", errorData);
                return Response.json({ 
                    error: 'Failed to create tour folder',
                    details: errorData
                }, { status: 500 });
            }

            const folderData = await createFolderResponse.json();
            tourFolderId = folderData.id;
            console.log("Created folder:", tourFolderId);
        }

        // Upload file to tour folder
        // Extract order number from orderId format: "Tour Name | Online Tickets - Order 1234"
        const orderNumberMatch = orderId.match(/Order\s+(\d+)/i);
        const orderNumber = orderNumberMatch ? orderNumberMatch[1] : orderId;
        const finalFileName = `${firstName} ${lastName}-${tourName}-Order ${orderNumber}.pdf`;

        // Upload file metadata
        const metadataResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: finalFileName,
                parents: [tourFolderId]
            })
        });

        if (!metadataResponse.ok) {
            const errorData = await metadataResponse.json();
            console.error("Metadata upload error:", errorData);
            return Response.json({ 
                error: 'Failed to initiate file upload',
                details: errorData
            }, { status: 500 });
        }

        const uploadUrl = metadataResponse.headers.get('Location');
        console.log("Got upload URL:", uploadUrl);

        // Upload file content
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': fileType || 'application/octet-stream'
            },
            body: fileBytes
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error("File upload error:", errorText);
            return Response.json({ 
                error: 'Failed to upload file',
                details: errorText
            }, { status: 500 });
        }

        const uploadedFile = await uploadResponse.json();
        console.log("File uploaded:", uploadedFile.id);

        // Get shareable link
        const fileUrl = `https://drive.google.com/file/d/${uploadedFile.id}/view`;

        return Response.json({
            success: true,
            fileId: uploadedFile.id,
            fileUrl: fileUrl,
            fileName: finalFileName,
            tourFolder: tourName
        });

    } catch (error) {
        console.error("Upload error:", error);
        return Response.json({ 
            error: error.message,
            details: error.toString()
        }, { status: 500 });
    }
});