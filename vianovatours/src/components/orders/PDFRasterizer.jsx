import * as pdfjsLib from 'pdfjs-dist';

// Set worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Rasterizes a PDF file by rendering pages to canvas and applying redaction masks
 * @param {File} file - The PDF file to rasterize
 * @param {Object} preset - Redaction preset with masks array
 * @returns {Promise<Blob>} - Rasterized PDF as blob
 */
export async function rasterizePDF(file, preset) {
  if (!preset?.masks || preset.masks.length === 0) {
    // No masks, return original
    return file;
  }

  const { PDFDocument } = await import('pdf-lib');
  
  // Load the PDF
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const dpi = preset.dpi || 200;
  const scale = dpi / 72; // PDF default is 72 DPI
  const jpegQuality = preset.jpeg_quality || 0.8;
  const applyToAllPages = preset.apply_to_all_pages !== false;
  
  // Create new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Process each page
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');
    
    // Render PDF page to canvas
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    // Apply redaction masks
    const pageMasks = preset.masks.filter(m => 
      !m.page || m.page === pageNum || (applyToAllPages && !m.page)
    );
    
    context.fillStyle = 'white';
    for (const mask of pageMasks) {
      const x = mask.x * viewport.width;
      const y = mask.y * viewport.height;
      const width = mask.width * viewport.width;
      const height = mask.height * viewport.height;
      
      context.fillRect(x, y, width, height);
    }
    
    // Convert canvas to JPEG
    const imageDataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
    const imageBytes = Uint8Array.from(atob(imageDataUrl.split(',')[1]), c => c.charCodeAt(0));
    
    // Embed image in new PDF
    const image = await pdfDoc.embedJpg(imageBytes);
    const pdfPage = pdfDoc.addPage([viewport.width, viewport.height]);
    pdfPage.drawImage(image, {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height
    });
  }
  
  // Save the rasterized PDF
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}