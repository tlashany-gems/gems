
import { GoogleGenAI, Type } from "@google/genai";
import { ChallengeType, Challenge } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  generateChallenge: async (type: ChallengeType): Promise<Challenge> => {
    const prompt = `Generate a unique and fun Arabic challenge for a group game of type: ${type}. 
    Return a JSON object with: title, description, and if applicable: question, options (array of 4), correctAnswer.
    Format specifically for ${type}.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            question: { type: Type.STRING },
            options: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            correctAnswer: { type: Type.STRING },
            secretWord: { type: Type.STRING },
            spyWord: { type: Type.STRING }
          },
          required: ["title", "description"]
        }
      }
    });

    try {
      const data = JSON.parse(response.text);
      return { ...data, type };
    } catch (e) {
      // Fallback
      return {
        type: ChallengeType.TRIVIA,
        title: "سؤال سريع",
        description: "أجب بسرعة للحصول على النقاط",
        question: "ما هو أكبر كوكب في المجموعة الشمسية؟",
        options: ["المريخ", "المشتري", "الأرض", "زحل"],
        correctAnswer: "المشتري"
      };
    }
  }
};
