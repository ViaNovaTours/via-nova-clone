import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Upload, X, Save, Trash2, Eye, EyeOff, Square } from "lucide-react";
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export default function PDFPresetEditor({ tourName, preset, onSave }) {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [masks, setMasks] = useState(preset?.masks || []);
  const [applyToAllPages, setApplyToAllPages] = useState(preset?.apply_to_all_pages !== false);
  const [dpi, setDpi] = useState(preset?.dpi || 200);
  const [jpegQuality, setJpegQuality] = useState(preset?.jpeg_quality || 0.8);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [currentRect, setCurrentRect] = useState(null);
  const [showMasks, setShowMasks] = useState(true);
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') return;

    setPdfFile(file);
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    setPdfDoc(pdf);
    setTotalPages(pdf.numPages);
    setCurrentPage(1);
  };

  useEffect(() => {
    if (pdfDoc) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage]);

  const renderPage = async (pageNum) => {
    if (!pdfDoc || !canvasRef.current) return;

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
  };

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x, y };
  };

  const handleMouseDown = (e) => {
    const pos = getCanvasCoordinates(e);
    setIsDrawing(true);
    setStartPos(pos);
    setCurrentRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !startPos) return;

    const pos = getCanvasCoordinates(e);
    setCurrentRect({
      x: Math.min(startPos.x, pos.x),
      y: Math.min(startPos.y, pos.y),
      width: Math.abs(pos.x - startPos.x),
      height: Math.abs(pos.y - startPos.y)
    });
  };

  const handleMouseUp = () => {
    if (currentRect && currentRect.width > 0.01 && currentRect.height > 0.01) {
      const newMask = {
        ...currentRect,
        page: applyToAllPages ? undefined : currentPage
      };
      setMasks([...masks, newMask]);
    }
    setIsDrawing(false);
    setStartPos(null);
    setCurrentRect(null);
  };

  const deleteMask = (index) => {
    setMasks(masks.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave({
      apply_to_all_pages: applyToAllPages,
      dpi: dpi,
      jpeg_quality: jpegQuality,
      masks: masks
    });
  };

  const getPageMasks = () => {
    return masks.filter(m => !m.page || m.page === currentPage);
  };

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>PDF Redaction Preset for {tourName}</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={showMasks ? "default" : "outline"}
              onClick={() => setShowMasks(!showMasks)}
            >
              {showMasks ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>
            {masks.length > 0 && (
              <Badge variant="secondary">{masks.length} masks</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Settings */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>DPI (Quality)</Label>
            <Input
              type="number"
              value={dpi}
              onChange={(e) => setDpi(Number(e.target.value))}
              min={72}
              max={300}
              step={25}
            />
          </div>
          <div className="space-y-2">
            <Label>JPEG Quality</Label>
            <Input
              type="number"
              value={jpegQuality}
              onChange={(e) => setJpegQuality(Number(e.target.value))}
              min={0.1}
              max={1}
              step={0.05}
            />
          </div>
          <div className="flex items-center space-x-2 pt-7">
            <Switch
              checked={applyToAllPages}
              onCheckedChange={setApplyToAllPages}
            />
            <Label>Apply to all pages</Label>
          </div>
        </div>

        {/* File Upload */}
        {!pdfFile ? (
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
            <Upload className="w-12 h-12 mx-auto text-slate-400 mb-4" />
            <p className="text-slate-600 mb-4">Upload a sample PDF to create redaction masks</p>
            <Button asChild>
              <label htmlFor="pdf-upload" className="cursor-pointer">
                Choose PDF File
                <input
                  id="pdf-upload"
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </Button>
          </div>
        ) : (
          <>
            {/* PDF Canvas */}
            <div className="border border-slate-300 rounded-lg overflow-hidden bg-slate-100">
              <div className="bg-slate-800 p-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-white text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setPdfFile(null);
                    setPdfDoc(null);
                    setCurrentPage(1);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div 
                ref={containerRef} 
                className="relative bg-white"
                style={{ cursor: 'crosshair' }}
              >
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="max-w-full h-auto"
                />
                
                {/* Render existing masks */}
                {showMasks && canvasRef.current && getPageMasks().map((mask, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: 'absolute',
                      left: `${mask.x * 100}%`,
                      top: `${mask.y * 100}%`,
                      width: `${mask.width * 100}%`,
                      height: `${mask.height * 100}%`,
                      backgroundColor: 'rgba(255, 255, 255, 0.7)',
                      border: '2px solid #dc2626',
                      pointerEvents: 'none'
                    }}
                  />
                ))}

                {/* Current drawing rectangle */}
                {currentRect && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${currentRect.x * 100}%`,
                      top: `${currentRect.y * 100}%`,
                      width: `${currentRect.width * 100}%`,
                      height: `${currentRect.height * 100}%`,
                      backgroundColor: 'rgba(255, 255, 255, 0.5)',
                      border: '2px dashed #dc2626',
                      pointerEvents: 'none'
                    }}
                  />
                )}
              </div>
            </div>

            {/* Masks List */}
            {masks.length > 0 && (
              <div className="space-y-2">
                <Label>Defined Masks</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {masks.map((mask, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        <Square className="w-4 h-4 text-red-600" />
                        <span className="text-sm text-slate-700">
                          Mask {idx + 1}
                          {mask.page && ` (Page ${mask.page})`}
                          {!mask.page && applyToAllPages && ' (All pages)'}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMask(idx)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Save Button */}
        <div className="flex justify-end gap-2">
          <Button
            onClick={handleSave}
            disabled={masks.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Preset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}