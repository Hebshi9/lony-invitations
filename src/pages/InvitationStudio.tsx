import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import {
    Image as ImageIcon,
    Type,
    QrCode,
    Save,
    MonitorPlay,
    Send
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function InvitationStudio() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
    const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);
    const [templateName, setTemplateName] = useState('New Design');

    // Initialize Canvas
    useEffect(() => {
        if (canvasRef.current && !fabricCanvas) {
            const canvas = new fabric.Canvas(canvasRef.current, {
                width: 800,
                height: 600,
                backgroundColor: '#f3f4f6'
            });

            canvas.on('selection:created', (e) => setSelectedObject(e.selected?.[0] || null));
            canvas.on('selection:updated', (e) => setSelectedObject(e.selected?.[0] || null));
            canvas.on('selection:cleared', () => setSelectedObject(null));

            setFabricCanvas(canvas);

            // Cleanup
            return () => {
                canvas.dispose();
            }
        }
    }, [canvasRef]);

    // Add Background Image
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && fabricCanvas) {
            const reader = new FileReader();
            reader.onload = (f) => {
                const data = f.target?.result as string;
                fabric.Image.fromURL(data, (img) => {
                    if (!img.width || !img.height || !fabricCanvas.width || !fabricCanvas.height) return;

                    // Fit to canvas
                    const scale = Math.min(
                        fabricCanvas.width / img.width,
                        fabricCanvas.height / img.height
                    );
                    img.set({
                        scaleX: scale,
                        scaleY: scale,
                        selectable: false // Background shouldn't move
                    });
                    fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
                });
            };
            reader.readAsDataURL(file);
        }
    };

    // Add Dynamic Text Placeholder
    const addTextPlaceholder = (variable: string) => {
        if (!fabricCanvas) return;
        const text = new fabric.IText(`{${variable} } `, {
            left: 100,
            top: 100,
            fontFamily: 'Arial',
            fill: '#000000',
            fontSize: 40
        });
        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
    };

    // Add QR Placeholder
    const addQRPlaceholder = () => {
        if (!fabricCanvas) return;
        const rect = new fabric.Rect({
            left: 200,
            top: 200,
            fill: '#000000',
            width: 150,
            height: 150
        });
        // Group with text to indicate it's a QR
        const text = new fabric.Text('QR CODE', {
            fontSize: 20,
            fill: '#ffffff',
            originX: 'center',
            originY: 'center',
            left: 275,
            top: 275
        });

        const group = new fabric.Group([rect, text], {
            left: 200, top: 200
        });

        fabricCanvas.add(group);
        fabricCanvas.setActiveObject(group);
    }

    // --- PREVIEW ENGINE ---
    const generatePreview = () => {
        if (!fabricCanvas) return;

        // 1. Clone the canvas to avoid messing up the editor
        fabricCanvas.clone((cloned: fabric.Canvas) => {
            // 2. Mock Data
            const mockGuest = {
                name: "Faisal Al-Saud",
                ticket: "T-1001",
                qrData: "https://lony.app/checkin/123"
            };

            // 3. Replace Variables
            cloned.getObjects().forEach((obj: fabric.Object) => {
                // Text Replacement
                if (obj.type === 'i-text' || obj.type === 'text') {
                    const textObj = obj as fabric.IText;
                    if (textObj.text?.includes('{Guest Name}')) {
                        textObj.set('text', mockGuest.name);
                    }
                    if (textObj.text?.includes('{Ticket #}')) {
                        textObj.set('text', mockGuest.ticket);
                    }
                }

                // QR Replacement (Visual Check)
                // In a real scenario, we'd replace the QR Group with a generated QR image.
                // For now, we'll just change the text color to green to indicate "Mapped".
                if (obj.type === 'group') {
                    // We identified QR groups earlier by checking children or custom attributes
                    const group = obj as fabric.Group;
                    // Simple check: does it look like our placeholder?
                    if (group.getObjects().find((K: fabric.Object) => (K as fabric.Text).text === 'QR CODE')) {
                        const rect = group.getObjects()[0] as fabric.Rect;
                        rect.set('fill', '#2ecc71'); // Green = Active
                    }
                }
            });

            // 4. Render to Data URL (for display)
            const dataUrl = cloned.toDataURL({ format: 'png', multiplier: 0.5 });
            console.log('Preview Generated');

            // Show in a modal or new window (For now, just alert/log to prove it works)
            const win = window.open();
            if (win) win.document.write(`< img src = "${dataUrl}" style = "border: 2px solid #ccc; max-width: 100%;" /> `);
        });
    }



    // Save Template
    const saveTemplate = async () => {
        if (!fabricCanvas) return;

        try {
            const json = fabricCanvas.toJSON();
            // TODO: Get real event_id from context or params. For now, picking the first event for this user.
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { alert('Please login first'); return; }

            const { data: event } = await supabase.from('events').select('id').eq('user_id', user.id).limit(1).single();
            if (!event) { alert('No event found for this user'); return; }

            const { data, error } = await supabase.from('design_templates').insert({
                event_id: event.id,
                name: templateName,
                canvas_config: json,
                background_url: 'placeholder' // TODO: Upload to storage
            }).select().single();

            if (error) throw error;

            console.log('Saved Design:', data);
            alert('✅ Design Saved Successfully!');
            return data;
        } catch (error: any) {
            console.error('Save Error:', error);
            alert('Error saving: ' + error.message);
        }
    };

    const handleSendCampaign = async () => {
        if (!confirm('Are you sure you want to send this design to ALL guests?')) return;

        try {
            // 1. Save first
            const template = await saveTemplate();
            if (!template) return;

            // 2. Create Campaign
            const { data: campaign, error: cError } = await supabase.from('campaigns').insert({
                event_id: template.event_id,
                template_id: template.id,
                name: `Campaign: ${templateName} `,
                status: 'draft'
            }).select().single();

            if (cError) throw cError;

            // 3. Trigger Backend
            // Assuming the backend acts as a microservice on a different port or same domain/api
            // Adjust URL based on where agent-dist is running (likely localhost:3001 or via proxy)
            const response = await fetch('http://localhost:3001/api/campaign/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId: campaign.id })
            });

            const result = await response.json();
            if (result.error) throw new Error(result.error);

            alert(`🚀 Campaign Started! ${result.message} `);

        } catch (error: any) {
            console.error('Send Error:', error);
            alert('Error starting campaign: ' + error.message);
        }
    }

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar Controls */}
            <div className="w-64 bg-white shadow-lg p-4 flex flex-col gap-4">
                <h2 className="text-xl font-bold mb-4">Studio 🎨</h2>

                <div className="space-y-2">
                    <label className="block text-sm font-medium">Template Name</label>
                    <input
                        className="w-full border p-2 rounded"
                        value={templateName}
                        onChange={e => setTemplateName(e.target.value)}
                    />
                </div>

                <div className="border-t pt-4">
                    <h3 className="font-semibold mb-2">Assets</h3>
                    <label className="flex items-center gap-2 cursor-pointer bg-blue-50 p-2 rounded hover:bg-blue-100">
                        <ImageIcon size={20} />
                        <span>Upload Background</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                </div>

                <div className="border-t pt-4">
                    <h3 className="font-semibold mb-2">Dynamic Fields</h3>
                    <button onClick={() => addTextPlaceholder('Guest Name')} className="w-full flex items-center gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100 mb-2">
                        <Type size={16} /> Guest Name
                    </button>
                    <button onClick={() => addTextPlaceholder('Ticket #')} className="w-full flex items-center gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100">
                        <Type size={16} /> Ticket Number
                    </button>
                    <button onClick={addQRPlaceholder} className="w-full flex items-center gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100 mt-2">
                        <QrCode size={16} /> QR Code Box
                    </button>
                </div>

                <div className="mt-auto">
                    <button onClick={generatePreview} className="w-full bg-indigo-600 text-white p-3 rounded flex items-center justify-center gap-2 hover:bg-indigo-700 mb-2">
                        <MonitorPlay size={20} /> Preview (Test)
                    </button>
                    <button onClick={saveTemplate} className="w-full bg-green-600 text-white p-3 rounded flex items-center justify-center gap-2 hover:bg-green-700 mb-2">
                        <Save size={20} /> Save Design
                    </button>
                    <button onClick={handleSendCampaign} className="w-full bg-orange-600 text-white p-3 rounded flex items-center justify-center gap-2 hover:bg-orange-700">
                        <Send size={20} /> Launch Campaign
                    </button>
                </div>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 p-8 flex justify-center items-center overflow-auto">
                <div className="bg-white shadow-2xl">
                    <canvas ref={canvasRef} />
                </div>
            </div>

            {/* Properties Panel (Right) - Simplified */}
            {selectedObject && (
                <div className="w-64 bg-white p-4 border-l">
                    <h3 className="font-bold mb-4">Properties</h3>
                    <p className="text-sm text-gray-500">Selected: {selectedObject.type}</p>
                    {/* Add color/font controls here later */}
                </div>
            )}
        </div>
    );
}
