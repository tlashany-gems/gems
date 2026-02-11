
import { GoogleGenAI, Type } from "@google/genai";
import { ChallengeType, Challenge } from "../types";

export const geminiService = {
  generateChallenge: async (type: ChallengeType): Promise<Challenge> => {
    try {
      // ننشئ المثيل هنا لضمان وجود مفتاح الـ API والبيئة جاهزة
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const prompt = `Generate a unique and fun Arabic challenge for a group game of type: ${type}. 
      The content should be engaging and suitable for more than 10 players.
      Return a JSON object with: title, description, question, options (array of 4), and correctAnswer.`;

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
              correctAnswer: { type: Type.STRING }
            },
            required: ["title", "description", "question", "options", "correctAnswer"]
          }
        }
      });

      const data = JSON.parse(response.text);
      return { ...data, type };
    } catch (e) {
      console.error("Gemini Error:", e);
      // Fallback
      return {
        type: ChallengeType.TRIVIA,
        title: "سؤال كلاسيكي",
        description: "أجب بسرعة قبل الجميع!",
        question: "ما هو أسرع حيوان بري في العالم؟",
        options: ["الأسد", "الفهد", "الغزال", "الحصان"],
        correctAnswer: "الفهد"
      };
    }
  }
};
