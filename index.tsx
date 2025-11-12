
import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Modality } from "@google/genai";

// --- Helper Function for Image Resizing ---
const resizeImage = (file: File, maxDimension: number): Promise<{ dataUrl: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (!event.target?.result || typeof event.target.result !== 'string') {
                return reject(new Error('FileReader did not return a string result.'));
            }
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;

                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    return reject(new Error('Could not get 2D context from canvas.'));
                }

                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to JPEG for better compression of photographic images, which speeds up upload.
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                resolve({ dataUrl, mimeType: 'image/jpeg' });
            };
            img.onerror = (err) => reject(err);
            img.src = event.target.result;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
};


// --- Main App Component ---
const App = () => {
    const [originalImage, setOriginalImage] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState('');
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setError(null);
            setEditedImage(null);
            setIsLoading(true);
            try {
                // Resize images larger than 1024px on their longest side for performance
                const { dataUrl, mimeType } = await resizeImage(file, 1024);
                setOriginalImage(dataUrl);
                setMimeType(mimeType);
            } catch (err) {
                setError('Could not process image. Please try another file.');
                setOriginalImage(null);
                setMimeType('');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleEditRequest = async () => {
        if (!originalImage || !prompt || !mimeType) {
            setError('Please upload an image and enter a prompt.');
            return;
        }
        setError(null);
        setIsLoading(true);
        setEditedImage(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        {
                            inlineData: {
                                data: originalImage.split(',')[1],
                                mimeType: mimeType,
                            },
                        },
                        { text: prompt },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });
            const firstPart = response.candidates?.[0]?.content?.parts?.[0];
            if (firstPart?.inlineData?.data) {
                const base64ImageBytes: string = firstPart.inlineData.data;
                const imageUrl = `data:${firstPart.inlineData.mimeType};base64,${base64ImageBytes}`;
                setEditedImage(imageUrl);
            } else {
                throw new Error('No image data received from the API.');
            }
        } catch (err) {
            setError('Failed to edit image. Please check the prompt or try again.');
            setEditedImage(null);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="main-container">
            <header className="header">
                <h1 className="title">Imagin</h1>
                <p className="subtitle">Describe the changes you want to see. The AI will bring them to life.</p>
            </header>

            <div className="controls-container">
                <input
                    type="text"
                    className="prompt-input"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., 'make the sky purple' or 'add a dog'"
                    disabled={!originalImage || isLoading}
                    aria-label="Editing prompt"
                />
                <div className="button-group">
                    <button className="button button-secondary" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                        {originalImage ? 'Change Image' : 'Upload Image'}
                    </button>
                    <button className="button" onClick={handleEditRequest} disabled={!originalImage || !prompt || isLoading}>
                        Generate Edit
                    </button>
                </div>
            </div>
            
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                style={{ display: 'none' }}
                accept="image/*"
            />

            {error && <p className="error-message">{error}</p>}

            <div className="image-comparison-container">
                {originalImage && (
                    <div className="image-container">
                        <h2 className="image-label">Original</h2>
                        <img src={originalImage} alt="Original" className="image-display" />
                    </div>
                )}
                {originalImage && (
                    <div className="image-container">
                        <h2 className="image-label">Edited</h2>
                        <div className="image-placeholder">
                            {isLoading && !editedImage ? (
                                <div className="spinner"></div>
                            ) : editedImage ? (
                                <img src={editedImage} alt="Edited" className="image-display" />
                            ) : (
                                <p>Your edited image will appear here.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);App