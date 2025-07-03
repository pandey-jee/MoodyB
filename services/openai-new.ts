import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "default_key" 
});

export interface MoodAnalysis {
  energy: number;
  valence: number; 
  dominantEmotions: string[];
  suggestedGenres: string[];
  reflection: string;
}

export async function analyzeMood(moodText: string, energy: number, valence: number): Promise<MoodAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an empathetic AI counselor. Analyze mood and suggest music genres."
        },
        {
          role: "user",
          content: `Analyze: "${moodText}" Energy: ${energy}/10 Positivity: ${valence}/10. Return JSON with energy, valence, dominantEmotions, suggestedGenres, reflection.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const analysis = JSON.parse(content);
      return {
        energy: analysis.energy || energy,
        valence: analysis.valence || valence,
        dominantEmotions: analysis.dominantEmotions || ["neutral"],
        suggestedGenres: analysis.suggestedGenres || ["pop"],
        reflection: analysis.reflection || "Thank you for sharing your feelings."
      };
    }
  } catch (error) {
    console.error("OpenAI analysis failed:", error);
  }
  
  // Fallback analysis
  const fallbackGenres = valence >= 7 ? ["pop", "dance"] : 
                        valence <= 3 ? ["blues", "folk"] : 
                        ["pop", "rock"];
  
  const fallbackEmotions = valence >= 7 ? ["happy", "energetic"] :
                          valence <= 3 ? ["sad", "reflective"] :
                          ["neutral", "contemplative"];
  
  return {
    energy,
    valence,
    dominantEmotions: fallbackEmotions,
    suggestedGenres: fallbackGenres,
    reflection: "Thank you for sharing your feelings. I'm here to listen and help you explore your emotions through music."
  };
}

export async function generateDailyAffirmation(recentMoods: string[]): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Generate a short daily affirmation based on mood patterns."
        },
        {
          role: "user",
          content: `Based on moods: ${recentMoods.join(", ")}, create a short affirmation.`
        }
      ],
      temperature: 0.8,
      max_tokens: 100
    });

    return response.choices[0]?.message?.content?.trim() || 
           "Every feeling you experience is valid and brings you closer to understanding yourself.";
  } catch (error) {
    console.error("Affirmation generation failed:", error);
    return "Every feeling you experience is valid and brings you closer to understanding yourself.";
  }
}
