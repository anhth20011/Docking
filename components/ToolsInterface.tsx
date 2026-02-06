import React, { useState } from 'react';
import { AspectRatio } from '../types';
import { analyzeProteinImage, generateMolecularImage, editMolecularImage } from '../services/geminiService';
import { IconUpload, IconLoader, IconImage, IconAnalysis, IconEdit } from './Icons';

export const ToolsInterface: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'analyze' | 'generate' | 'edit'>('analyze');

  // Analysis State
  const [analysisImage, setAnalysisImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Generation State
  const [genPrompt, setGenPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Edit State
  const [editImage, setEditImage] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editedImageResult, setEditedImageResult] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Handlers
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (s: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const runAnalysis = async () => {
    if (!analysisImage) return;
    setIsAnalyzing(true);
    try {
      const base64 = analysisImage.split(',')[1];
      const result = await analyzeProteinImage(base64, "Describe the biological structure in this image.");
      setAnalysisResult(result || "No analysis returned.");
    } catch (e) {
      setAnalysisResult("Error analyzing image.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runGeneration = async () => {
    if (!genPrompt) return;
    setIsGenerating(true);
    try {
      const result = await generateMolecularImage(genPrompt, aspectRatio);
      setGeneratedImage(result);
    } catch (e) {
      alert("Error generating image");
    } finally {
      setIsGenerating(false);
    }
  };

  const runEdit = async () => {
    if (!editImage || !editPrompt) return;
    setIsEditing(true);
    try {
      const base64 = editImage.split(',')[1];
      const result = await editMolecularImage(base64, editPrompt);
      setEditedImageResult(result);
    } catch (e) {
      alert("Error editing image");
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-800 p-1 rounded-lg w-fit">
        {[
          { id: 'analyze', label: 'Analyze Structure', icon: IconAnalysis },
          { id: 'generate', label: 'Generate Visuals', icon: IconImage },
          { id: 'edit', label: 'Edit Diagram', icon: IconEdit },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id 
                ? 'bg-science-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pr-2">
        {/* Analyze Tab */}
        {activeTab === 'analyze' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-100 mb-4">Gemini 3 Pro Vision Analysis</h3>
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                        <div className="border-2 border-dashed border-slate-600 rounded-lg h-64 flex flex-col items-center justify-center bg-slate-900/50 relative overflow-hidden group">
                             {analysisImage ? (
                                <img src={analysisImage} alt="Analysis Target" className="w-full h-full object-contain" />
                             ) : (
                                <div className="text-center p-4">
                                    <IconUpload className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                                    <span className="text-slate-400 text-sm">Upload structure image</span>
                                </div>
                             )}
                             <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, setAnalysisImage)} className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                        <button 
                            onClick={runAnalysis}
                            disabled={!analysisImage || isAnalyzing}
                            className="mt-4 w-full bg-science-600 hover:bg-science-500 disabled:opacity-50 text-white py-2 rounded-lg font-medium flex justify-center items-center gap-2"
                        >
                            {isAnalyzing ? <IconLoader className="w-4 h-4" /> : <IconAnalysis className="w-4 h-4" />}
                            Analyze Structure
                        </button>
                    </div>
                    <div className="flex-1 bg-slate-900 rounded-lg p-4 border border-slate-700 min-h-[200px]">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Analysis Results</h4>
                        <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {analysisResult || "Upload an image and click analyze to see Gemini's interpretation."}
                        </div>
                    </div>
                </div>
            </div>
          </div>
        )}

        {/* Generate Tab */}
        {activeTab === 'generate' && (
          <div className="space-y-6 animate-fade-in">
             <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-100 mb-4">Gemini 3 Pro Image Generation</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Prompt</label>
                            <textarea 
                                value={genPrompt}
                                onChange={(e) => setGenPrompt(e.target.value)}
                                placeholder="E.g., A realistic protein structure with a heme cofactor in the active site, cinematic lighting"
                                className="w-full h-32 bg-slate-900 border border-slate-600 rounded-lg p-3 text-slate-200 focus:outline-none focus:border-science-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Aspect Ratio</label>
                            <select 
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-slate-200"
                            >
                                {Object.entries(AspectRatio).map(([key, value]) => (
                                    <option key={key} value={value}>{key} ({value})</option>
                                ))}
                            </select>
                        </div>
                        <button 
                            onClick={runGeneration}
                            disabled={!genPrompt || isGenerating}
                            className="w-full bg-science-600 hover:bg-science-500 disabled:opacity-50 text-white py-2 rounded-lg font-medium flex justify-center items-center gap-2"
                        >
                            {isGenerating ? <IconLoader className="w-4 h-4" /> : <IconImage className="w-4 h-4" />}
                            Generate Visual
                        </button>
                    </div>
                    <div className="bg-slate-900 rounded-lg border border-slate-700 flex items-center justify-center min-h-[300px]">
                        {generatedImage ? (
                            <img src={generatedImage} alt="Generated Molecule" className="max-w-full max-h-[400px] rounded-lg" />
                        ) : (
                            <span className="text-slate-600 text-sm">Generated image will appear here</span>
                        )}
                    </div>
                </div>
             </div>
          </div>
        )}

        {/* Edit Tab */}
        {activeTab === 'edit' && (
          <div className="space-y-6 animate-fade-in">
             <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-100 mb-4">Nano Banana (Gemini 2.5 Flash Image) Edit</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {/* Input Section */}
                     <div className="space-y-4">
                        <div className="border-2 border-dashed border-slate-600 rounded-lg h-48 flex flex-col items-center justify-center bg-slate-900/50 relative overflow-hidden">
                             {editImage ? (
                                <img src={editImage} alt="To Edit" className="w-full h-full object-contain" />
                             ) : (
                                <div className="text-center p-4">
                                    <IconUpload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                                    <span className="text-slate-400 text-xs">Upload image to edit</span>
                                </div>
                             )}
                             <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, setEditImage)} className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                        
                        <div>
                             <label className="block text-sm font-medium text-slate-400 mb-1">Edit Instruction</label>
                             <input 
                                type="text"
                                value={editPrompt}
                                onChange={(e) => setEditPrompt(e.target.value)}
                                placeholder="E.g., Highlight the active site in red"
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200"
                            />
                        </div>

                         <button 
                            onClick={runEdit}
                            disabled={!editImage || !editPrompt || isEditing}
                            className="w-full bg-science-600 hover:bg-science-500 disabled:opacity-50 text-white py-2 rounded-lg font-medium flex justify-center items-center gap-2"
                        >
                            {isEditing ? <IconLoader className="w-4 h-4" /> : <IconEdit className="w-4 h-4" />}
                            Apply Edit
                        </button>
                     </div>

                     {/* Result Section */}
                     <div className="bg-slate-900 rounded-lg border border-slate-700 flex items-center justify-center min-h-[300px]">
                         {editedImageResult ? (
                            <img src={editedImageResult} alt="Edited Result" className="max-w-full max-h-[400px] rounded-lg" />
                         ) : (
                            <span className="text-slate-600 text-sm">Edited result will appear here</span>
                         )}
                     </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
