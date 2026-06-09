import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { run } from '../config/database.js';
import { DailySummaryModel } from '../models/DailySummary.js';

export const analyzeSteps = async (req: Request, res: Response) => {
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
    } catch (e) {
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
        await run('UPDATE daily_summaries SET steps = ?, ai_analysis = ? WHERE user_id = ? AND date = ?',
          [steps, JSON.stringify(analysisData), userId, today]);
      } else {
        await DailySummaryModel.create(userId, today, steps, JSON.stringify(analysisData));
      }
    }

    res.json(analysisData);
  } catch (error) {
    console.error('AI Analysis error:', error);
    res.status(500).json({ message: 'Error generating AI analysis' });
  }
};

/**
 * Nutrition lookup — Option 2 of the calorie calculator.
 *
 * The athlete types a free-text meal / dish / element name and the backend
 * "searches the web" (via the Gemini model's knowledge) for its nutrition
 * facts, returning calories + macros per 100 g. The frontend then multiplies
 * by the grams the athlete entered.
 *
 * SECURITY: the food name is sanitised and length-bounded before it reaches
 * the model to avoid prompt-injection / data-exfiltration.
 */
export const nutritionLookup = async (req: Request, res: Response) => {
  try {
    const rawName = ((req.body || {}).name ?? '').toString();
    // Keep letters, numbers, spaces and a few food-safe punctuation marks only.
    const name = rawName.replace(/[^\p{L}\p{N}\s\-'&(),.]/gu, '').trim().slice(0, 80);
    if (name.length < 2) {
      return res.status(400).json({ message: 'Please enter a valid food or meal name.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'Nutrition lookup is not configured on the server.' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      You are a nutrition database. For the food, dish or ingredient named exactly:
      "${name}"
      Return your best estimate of its nutrition facts PER 100 GRAMS as raw JSON
      (no markdown, no commentary) with these numeric fields:
      {
        "food": string (the normalised food name),
        "kcal_per_100g": number,
        "protein_per_100g": number,
        "carbs_per_100g": number,
        "fat_per_100g": number,
        "confidence": "high" | "medium" | "low"
      }
      If the name is not a recognisable food, set every numeric field to 0 and
      "confidence" to "low".
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text || '';
    let data: any;
    try {
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      data = JSON.parse(jsonStr);
    } catch {
      return res.status(502).json({ message: 'Could not read nutrition data. Try a simpler name.' });
    }

    const num = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : 0;
    };

    const result = {
      food: (typeof data.food === 'string' && data.food.trim()) || name,
      kcalPer100g: num(data.kcal_per_100g),
      proteinPer100g: num(data.protein_per_100g),
      carbsPer100g: num(data.carbs_per_100g),
      fatPer100g: num(data.fat_per_100g),
      confidence: ['high', 'medium', 'low'].includes(data.confidence) ? data.confidence : 'low',
    };

    if (result.kcalPer100g <= 0) {
      return res.status(404).json({ message: `No nutrition data found for "${name}".` });
    }

    res.json(result);
  } catch (error) {
    console.error('Nutrition lookup error:', error);
    res.status(500).json({ message: 'Error looking up nutrition data.' });
  }
};
