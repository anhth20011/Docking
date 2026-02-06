import { GoogleGenAI, Type } from "@google/genai";
import { AspectRatio } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Chat with Gemini 3 Pro
export const sendMessageToGemini = async (history: {role: string, parts: {text: string}[]}[], message: string) => {
  try {
    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      history: history,
      config: {
        systemInstruction: "You are an expert computational chemist and structural biologist specializing in molecular docking, AutoDock Vina, and protein-ligand interactions. Provide scientific, precise, and helpful answers.",
      }
    });

    const response = await chat.sendMessage({ message });
    return response.text;
  } catch (error) {
    console.error("Chat Error:", error);
    throw error;
  }
};

// Analyze Image with Gemini 3 Pro
export const analyzeProteinImage = async (base64Image: string, prompt: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: prompt || "Analyze this molecular structure/diagram. Identify the key domains, secondary structures, or potential binding pockets visible." }
        ]
      }
    });
    return response.text;
  } catch (error) {
    console.error("Analysis Error:", error);
    throw error;
  }
};

// Generate Image with Gemini 3 Pro Image
export const generateMolecularImage = async (prompt: string, aspectRatio: AspectRatio) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: '1K'
        }
      }
    });
    
    // Extract image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Generation Error:", error);
    throw error;
  }
};

// Edit Image with Gemini 2.5 Flash Image (Nano Banana)
export const editMolecularImage = async (base64Image: string, prompt: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Image } },
          { text: prompt }
        ]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Edit Error:", error);
    throw error;
  }
};
