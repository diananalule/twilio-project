import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-pro" });

export async function getIntentAndEntities(userMessage) {
    const prompt = `
You are an NLU engine for a security operations chatbot.
Extract the user's intent and entities from their request.
Respond with a valid JSON object: { "intent": "...", "entities": { ... } }

Available intents:
- getPatrolReports: siteName, date
- getSiteInfo: siteName
- getGuardInfo: guardName
- getSitePerformance: siteName, timeframe
- getAllSites: (no entities)
- getSystemStats: (no entities)

Examples:
User: "show me the patrol report for the main gate from yesterday"
{ "intent": "getPatrolReports", "entities": { "siteName": "main gate", "date": "yesterday" } }

User: "tell me about guard John Smith"
{ "intent": "getGuardInfo", "entities": { "guardName": "John Smith" } }

User: "list all sites"
{ "intent": "getAllSites", "entities": {} }

Now, analyze: "${userMessage}"
`;

    try {
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Gemini NLU error:", error);
        return null;
    }
}