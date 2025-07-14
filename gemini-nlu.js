import fetch from "node-fetch";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export async function getIntentAndEntities(userMessage) {
    const prompt = `
You are an NLU engine for a security operations chatbot.
Extract the user's intent and entities from their request.
Respond with a valid JSON object: { "intent": "...", "entities": { ... } }

Available intents:
- getPatrolReports: siteName, date
- getSiteInfo: siteName
- getGuardInfo: guardName
- getGuardsForSite: siteName
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

User: "list all guards for Atom site"
{ "intent": "getGuardsForSite", "entities": { "siteName": "Atom site" } }

User: "give me the information of all guards on Atom site"
{ "intent": "getGuardsForSite", "entities": { "siteName": "Atom site" } }

User: "all guard info for Atom site"
{ "intent": "getGuardsForSite", "entities": { "siteName": "Atom site" } }

User: "give me all the guard information of Atom site"
{ "intent": "getGuardsForSite", "entities": { "siteName": "Atom site" } }

User: "show me all guards for Test site"
{ "intent": "getGuardsForSite", "entities": { "siteName": "Test site" } }

User: "guard info for Walker Adams"
{ "intent": "getGuardInfo", "entities": { "guardName": "Walker Adams" } }

User: "give me information about guard Avo Yiga"
{ "intent": "getGuardInfo", "entities": { "guardName": "Avo Yiga" } }

User: "list guards for Sheraton Hotel"
{ "intent": "getGuardsForSite", "entities": { "siteName": "Sheraton Hotel" } }

Now, analyze: "${userMessage}"
`;

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: prompt }
                        ]
                    }
                ]
            })
        });

        const data = await response.json();
        // Extract the model's reply text
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
        let parsed;
        try {
            parsed = JSON.parse(jsonString);
        } catch (err) {
            console.error("Gemini NLU JSON parse error:", err, jsonString);
            return null;
        }
        return parsed;
    } catch (error) {
        console.error("Gemini NLU error:", error);
        return null;
    }
}

