
import { GoogleGenAI, Type } from "@google/genai";
import { ChallengeType, Challenge } from "../types";

export const geminiService = {
  generateChallenge: async (type: ChallengeType): Promise<Challenge> => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      let systemInstruction = "أنت خبير في تصميم الألعاب الجماعية التفاعلية والممتعة باللغة العربية. مهمتك إنشاء محتوى ألعاب ذكي ومبتكر.";
      let prompt = "";

      switch (type) {
        case ChallengeType.TRIVIA:
          prompt = "ولد سؤال تريفيا ثقافي مدهش مع 4 خيارات وإجابة صحيحة واحدة. اجعل السؤال ممتعاً وغير تقليدي.";
          break;
        case ChallengeType.UNDERCOVER:
          prompt = "أنت الآن تصمم جولة للعبة 'الجاسوس'. اختر كلمتين (secretWord للعملاء) و (spyWord للجاسوس) بحيث تكونان من نفس الفئة ومن الصعب التفريق بينهما بسهولة (مثلاً: بيبسي وكوكاكولا، أو ميسي ورونالدو). املأ الحقول بدقة.";
          break;
        case ChallengeType.TRUTH_LIE:
          prompt = "اختر حقيقة مذهلة وكذبة ذكية عن شيء مشهور. اطلب من اللاعبين تخمين الكذبة.";
          break;
        case ChallengeType.STORY:
          prompt = "ابدأ قصة خيالية مجنونة بجملة واحدة، ووفر 4 خيارات لتكملتها.";
          break;
        case ChallengeType.CITY_BUILD:
          prompt = "اطرح معضلة لبناء مدينة (مثلاً: بناء حديقة عامة أو مول تجاري) مع ذكر العواقب.";
          break;
        case ChallengeType.TEAM_WAR:
          prompt = "سؤال تحدي سرعة بديهة يحتاج إجابة قصيرة ومباشرة.";
          break;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction,
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

      const data = JSON.parse(response.text);
      return { ...data, type };
    } catch (e) {
      console.error("Gemini Error:", e);
      return {
        type: ChallengeType.TRIVIA,
        title: "تحدي احتياطي",
        description: "حدث خطأ في الاتصال، إليك تحدي سريع!",
        question: "ما هو الكوكب الأحمر؟",
        options: ["المريخ", "المشتري", "الزهرة", "عطارد"],
        correctAnswer: "المريخ"
      };
    }
  }
};
