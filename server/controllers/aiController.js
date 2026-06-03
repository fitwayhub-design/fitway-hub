import { GoogleGenAI } from '@google/genai';
import { run } from '../config/database.js';
import { DailySummaryModel } from '../models/DailySummary.js';
export const analyzeSteps = async (req, res) => {
    try {
        const userId = req.user?.id;
        // SECURITY: coerce and bound `steps` before injecting into the LLM prompt.
        // The previous code interpolated the raw body value, allowing prompt injection
        // ("ignore previous instructions…") and unbounded data exfiltration via the model.
        const rawSteps = (req.body || {}).steps;
        const stepsNum = Number(rawSteps);
        if (!Number.isFinite(stepsNum) || stepsNum < 0 || stepsNum > 200_000) {
            return res.status(400).json({ message: 'Steps must be a non-negative number ≤ 200000' });
        }
        const steps = Math.floor(stepsNum);
        // Initialize Gemini API
        // Note: In a real app, use a service to manage the client
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ message: 'Gemini API key not configured' });
        }
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `
      User walked ${steps} steps today.
      Return a JSON object with the following fields:
      1. performance_rating (string: "Excellent", "Good", "Fair", "Needs Improvement")
      2. health_advice (string: one sentence advice)
      3. motivational_message (string: short encouraging message)
      4. tomorrow_goal (number: suggested step count for tomorrow)

      Do not include markdown formatting, just the raw JSON.
    `;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        const text = response.text;
        // Parse JSON from response (handling potential markdown code blocks)
        let analysisData;
        try {
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            analysisData = JSON.parse(jsonStr);
        }
        catch (e) {
            console.error('Failed to parse AI response:', text);
            analysisData = {
                performance_rating: "Unknown",
                health_advice: "Keep moving!",
                motivational_message: "Great job tracking your steps.",
                tomorrow_goal: steps + 500
            };
        }
        // Save to DB if user is authenticated
        if (userId) {
            const today = new Date().toISOString().split('T')[0];
            const existing = await DailySummaryModel.findByUserAndDate(userId, today);
            if (existing) {
                await run('UPDATE daily_summaries SET steps = ?, ai_analysis = ? WHERE user_id = ? AND date = ?', [steps, JSON.stringify(analysisData), userId, today]);
            }
            else {
                await DailySummaryModel.create(userId, today, steps, JSON.stringify(analysisData));
            }
        }
        res.json(analysisData);
    }
    catch (error) {
        console.error('AI Analysis error:', error);
        res.status(500).json({ message: 'Error generating AI analysis' });
    }
};
//# sourceMappingURL=aiController.js.map