import "dotenv/config";
import express from "express";
import twilio from "twilio";
import GuardTourAPI from './askari-api.js';
import { getIntentAndEntities } from "./gemini-nlu.js";

const app = express();
const port = process.env.PORT || 3000;

// Initialize GuardTour API client
const guardTourAPI = new GuardTourAPI();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Enhanced intent patterns
const intentPatterns = {
    'patrol_report': [
        /show.*patrol report.*for (.*)/i,
        /get patrol report.*for (.*)/i, 
        /patrol.*report.*(.*)/i,
        /patrol.*status.*(.*)/i,
        /check patrol.*(.*)/i,
        /latest patrol.*(.*)/i,
        /patrols.*for (.*)/i
    ],
    'site_info': [
        /site.*info.*for (.*)/i,
        /tell me about site (.*)/i,
        /site.*details.*(.*)/i,
        /info.*site (.*)/i,
        /about site (.*)/i,
        /site (.*) info/i,
        /give.*site.*information/i // Added for "Give me the site information"
    ],
    'guard_info': [
        /guard.*info.*for (.*)/i,
        /tell me about guard (.*)/i,
        /guard.*details.*(.*)/i,
        /info.*guard (.*)/i,
        /about guard (.*)/i,
        /guard (.*) info/i,
        /give.*guard.*details/i // Added for "give me guard details"
    ],
    'site_performance': [
        /performance.*for (.*)/i,
        /site.*performance.*(.*)/i,
        /how.*doing.*(.*)/i,
        /performance.*report.*(.*)/i,
        /site.*stats.*(.*)/i
    ],
    'system_stats': [
        /system.*stats/i,
        /overall.*stats/i,
        /system.*status/i,
        /dashboard/i,
        /overview/i,
        /stats/i,
        /getSystemStats/i // Added for Gemini NLU
    ],
    'list_sites': [
        /list.*sites/i,
        /show.*all.*sites/i,
        /what.*sites/i,
        /sites.*list/i,
        /all.*sites/i,
        /getAllSites/i // Added for Gemini NLU
    ],
    'help': [
        /help/i,
        /what.*can.*do/i,
        /commands/i,
        /how.*use/i
    ],
    'getGuardsForSite': [
        /list all guards for (.*)/i,
        /all guard info for (.*)/i,
        /give me the information of all guards on (.*)/i
    ],
    'call_logs': [
        /call logs.*for (.*)/i,
        /site.*call.*logs.*(.*)/i,
        /call.*history.*(.*)/i,
        /show.*calls.*(.*)/i
    ],
    'shifts': [
        /shifts.*for (.*)/i,
        /site.*shifts.*(.*)/i,
        /schedule.*for (.*)/i,
        /guard.*shifts.*(.*)/i
    ],
    'notifications': [
        /notifications.*for (.*)/i,
        /site.*notifications.*(.*)/i,
        /alerts.*for (.*)/i,
        /site.*alerts.*(.*)/i
    ],
    'guard_performance': [
        /guard.*performance.*for (.*)/i,
        /performance.*guard (.*)/i,
        /guard.*stats.*(.*)/i
    ]
};

// Enhanced entity extraction
function extractEntities(message) {
    try {
        const entities = {
            siteName: null,
            guardName: null,
            date: null,
            timeframe: null,
            startDate: null,
            endDate: null,
            year: null,
            month: null,
            day: null
        };

        // Extract site name
        const siteMatch = message.match(/(?:for|about|of)\s+([A-Za-z0-9\s\-\(\)]+)$/i);
        if (siteMatch) {
            entities.siteName = siteMatch[1].trim();
        }

        // Extract guard name
        const guardMatch = message.match(/guard\s+([A-Za-z\s]+)/i);
        if (guardMatch) {
            entities.guardName = guardMatch[1].trim();
        }

        // Extract time references
        if (message.match(/yesterday/i)) {
            entities.timeframe = 'yesterday';
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            entities.date = yesterday.toISOString().split('T')[0];
        } else if (message.match(/today/i)) {
            entities.timeframe = 'today';
            entities.date = new Date().toISOString().split('T')[0];
        } else if (message.match(/this week/i)) {
            entities.timeframe = 'this_week';
        }

        // Extract year, month, day for performance queries
        const dateMatch = message.match(/(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/i);
        if (dateMatch) {
            entities.year = parseInt(dateMatch[1]);
            entities.month = parseInt(dateMatch[2]);
            entities.day = dateMatch[3] ? parseInt(dateMatch[3]) : null;
        }

        // Extract start and end dates for patrol queries
        const dateRangeMatch = message.match(/from\s+(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/i);
        if (dateRangeMatch) {
            entities.startDate = dateRangeMatch[1];
            entities.endDate = dateRangeMatch[2];
        }

        console.log(`🔍 Extracted entities: ${JSON.stringify(entities)}`);
        return entities;
    } catch (error) {
        console.error(`❌ Error in extractEntities: ${error.message}\n${error.stack}`);
        return {};
    }
}

// Intent recognition function
function recognizeIntent(message) {
    try {
        const normalizedMessage = message.toLowerCase().trim();
        console.log(`🔍 Processing message for intent recognition: "${normalizedMessage}"`);
        
        for (const [intent, patterns] of Object.entries(intentPatterns)) {
            for (const pattern of patterns) {
                if (pattern.test(normalizedMessage)) {
                    console.log(`✅ Recognized intent: ${intent}`);
                    return intent;
                }
            }
        }
        
        console.warn(`⚠️ No intent recognized for message: "${normalizedMessage}"`);
        return 'unknown';
    } catch (error) {
        console.error(`❌ Error in recognizeIntent: ${error.message}\n${error.stack}`);
        return 'unknown';
    }
}

function createOrGetAuthToken() {
    try {
        console.log('🔐 Creating or retrieving auth token');
        return 'mock-token'; // Replace with actual implementation
    } catch (error) {
        console.error(`❌ Error in createOrGetAuthToken: ${error.message}\n${error.stack}`);
        throw error;
    }
}

// Enhanced response generation
async function generateResponse(intent, entities, userPhone) {
    const authToken = createOrGetAuthToken();
    try {
        console.log(`🎯 Generating response for intent: ${intent}, entities: ${JSON.stringify(entities)}, user: ${userPhone}`);

        switch (intent) {
            case 'patrol_report':
                if (!entities.siteName) {
                    console.warn('⚠️ Missing siteName for patrol_report intent');
                    return `📋 Please specify which site you'd like to check.\n\nExample: "Show patrol report for Site Alpha"`;
                }
                try {
                    const patrolData = await guardTourAPI.getPatrolReports(entities.siteName, entities.startDate, entities.endDate);
                    console.log(`✅ Patrol report fetched for ${entities.siteName}`);
                    return patrolData.message;
                } catch (error) {
                    console.error(`❌ Error fetching patrol report for ${entities.siteName}: ${error.message}\n${error.stack}`);
                    return `❌ Sorry, I couldn't fetch the patrol report for ${entities.siteName}. ${error.message}`;
                }

            case 'site_info':
                if (!entities.siteName) {
                    console.warn('⚠️ Missing siteName for site_info intent');
                    return `🏢 Please specify which site you'd like to know about.\n\nExample: "Tell me about Site Alpha"`;
                }
                try {
                    const siteData = await guardTourAPI.getSiteInfo(entities.siteName);
                    console.log(`✅ Site info fetched for ${entities.siteName}`);
                    return siteData.message;
                } catch (error) {
                    console.error(`❌ Error fetching site info for ${entities.siteName}: ${error.message}\n${error.stack}`);
                    return `❌ Sorry, I couldn't fetch information for ${entities.siteName}. ${error.message}`;
                }

            case 'guard_info':
            case 'getGuardInfo': // Added for Gemini NLU
                if (!entities.guardName) {
                    console.warn('⚠️ Missing guardName for guard_info/getGuardInfo intent');
                    return `👮 Please specify which guard you'd like to know about.\n\nExample: "Tell me about guard John"`;
                }
                try {
                    const guardData = await guardTourAPI.getGuardInfo(entities.guardName);
                    console.log(`✅ Guard info fetched for ${entities.guardName}`);
                    return guardData.message;
                } catch (error) {
                    console.error(`❌ Error fetching guard info for ${entities.guardName}: ${error.message}\n${error.stack}`);
                    return `❌ Sorry, I couldn't fetch information for guard ${entities.guardName}. ${error.message}`;
                }

            case 'site_performance':
                if (!entities.siteName) {
                    console.warn('⚠️ Missing siteName for site_performance intent');
                    return `📊 Please specify which site you'd like the performance report for.\n\nExample: "Performance for Site Alpha"`;
                }
                try {
                    const performanceData = await guardTourAPI.getSitePerformance(entities.siteName, entities.year, entities.month, entities.day);
                    console.log(`✅ Site performance fetched for ${entities.siteName}`);
                    return performanceData.message;
                } catch (error) {
                    console.error(`❌ Error fetching site performance for ${entities.siteName}: ${error.message}\n${error.stack}`);
                    return `❌ Sorry, I couldn't fetch performance data for ${entities.siteName}. ${error.message}`;
                }

            case 'system_stats':
            case 'getSystemStats': // Added for Gemini NLU
                try {
                    const statsData = await guardTourAPI.getSystemStats();
                    console.log('✅ System stats fetched');
                    return statsData.message;
                } catch (error) {
                    console.error(`❌ Error fetching system stats: ${error.message}\n${error.stack}`);
                    return `❌ Sorry, I couldn't fetch system statistics. ${error.message}`;
                }

            case 'list_sites':
            case 'getAllSites': // Added for Gemini NLU
                try {
                    const sites = await guardTourAPI.getAllSites();
                    if (sites && sites.length > 0) {
                        let message = `🏢 **All Sites:**\n\n`;
                        sites.forEach((site, index) => {
                            message += `${index + 1}. ${site.name}`;
                            if (site.status) message += ` (${site.status})`;
                            message += `\n`;
                        });
                        console.log('✅ Sites list fetched');
                        return message;
                    } else {
                        console.warn('⚠️ No sites found');
                        return `No sites found in the system.`;
                    }
                } catch (error) {
                    console.error(`❌ Error fetching sites list: ${error.message}\n${error.stack}`);
                    return `❌ Sorry, could not fetch sites list. ${error.message}`;
                }

            case 'call_logs':
                if (!entities.siteName) {
                    console.warn('⚠️ Missing siteName for call_logs intent');
                    return `📞 Please specify which site you'd like call logs for.\n\nExample: "Call logs for Site Alpha"`;
                }
                try {
                    const callLogs = await guardTourAPI.getCallLogsForSite(entities.siteName);
                    console.log(`✅ Call logs fetched for ${entities.siteName}`);
                    return callLogs.message;
                } catch (error) {
                    console.error(`❌ Error fetching call logs for ${entities.siteName}: ${error.message}\n${error.stack}`);
                    return `❌ Sorry, I couldn't fetch call logs for ${entities.siteName}. ${error.message}`;
                }

            case 'shifts':
                if (!entities.siteName) {
                    console.warn('⚠️ Missing siteName for shifts intent');
                    return `🕒 Please specify which site you'd like shift details for.\n\nExample: "Shifts for Site Alpha"`;
                }
                try {
                    const shifts = await guardTourAPI.getShiftsForSite(entities.siteName);
                    console.log(`✅ Shifts fetched for ${entities.siteName}`);
                    return shifts.message;
                } catch (error) {
                    console.error(`❌ Error fetching shifts for ${entities.siteName}: ${error.message}\n${error.stack}`);
                    return `❌ Sorry, I couldn't fetch shifts for ${entities.siteName}. ${error.message}`;
                }

            case 'notifications':
                if (!entities.siteName) {
                    console.warn('⚠️ Missing siteName for notifications intent');
                    return `🔔 Please specify which site you'd like notifications for.\n\nExample: "Notifications for Site Alpha"`;
                }
                try {
                    const notifications = await guardTourAPI.getNotificationsForSite(entities.siteName);
                    console.log(`✅ Notifications fetched for ${entities.siteName}`);
                    return notifications.message;
                } catch (error) {
                    console.error(`❌ Error fetching notifications for ${entities.siteName}: ${error.message}\n${error.stack}`);
                    return `❌ Sorry, I couldn't fetch notifications for ${entities.siteName}. ${error.message}`;
                }

            case 'guard_performance':
                if (!entities.guardName) {
                    console.warn('⚠️ Missing guardName for guard_performance intent');
                    return `📊 Please specify which guard you'd like performance data for.\n\nExample: "Guard performance for John"`;
                }
                try {
                    const guardPerf = await guardTourAPI.getGuardPerformance(entities.guardName, entities.startDate, entities.endDate);
                    console.log(`✅ Guard performance fetched for ${entities.guardName}`);
                    return guardPerf.message;
                } catch (error) {
                    console.error(`❌ Error fetching guard performance for ${entities.guardName}: ${error.message}\n${error.stack}`);
                    return `❌ Sorry, I couldn't fetch performance data for guard ${entities.guardName}. ${error.message}`;
                }

            case 'help':
                console.log('✅ Help command triggered');
                return `🤖 **Askari WhatsApp Assistant**\n\nI can help you with:\n\n📋 **Patrol Reports**\n"Show patrol report for Site Alpha"\n\n🏢 **Site Information**\n"Tell me about Site Alpha"\n\n👮 **Guard Information**\n"Guard info for John"\n\n📊 **Site Performance**\n"Performance for Site Alpha 2025-07"\n\n📞 **Call Logs**\n"Call logs for Site Alpha"\n\n🕒 **Shifts**\n"Shifts for Site Alpha"\n\n🔔 **Notifications**\n"Notifications for Site Alpha"\n\n📊 **Guard Performance**\n"Guard performance for John"\n\n📈 **System Stats**\n"System stats"\n\n📋 **List All Sites**\n"List all sites"\n\nJust ask naturally!`;

            case 'getGuardsForSite':
                if (!entities.siteName) {
                    console.warn('⚠️ Missing siteName for getGuardsForSite intent');
                    return `Please specify the site name to list its guards.`;
                }
                try {
                    const guardsResult = await guardTourAPI.getGuardsForSite(entities.siteName);
                    console.log(`✅ Guards fetched for ${entities.siteName}`);
                    return guardsResult.message;
                } catch (error) {
                    console.error(`❌ Error fetching guards for ${entities.siteName}: ${error.message}\n${error.stack}`);
                    return `❌ Sorry, I couldn't fetch guards for ${entities.siteName}. ${error.message}`;
                }

            default:
                console.warn(`⚠️ Unknown intent: ${intent}`);
                return `I didn't understand that request. Type "help" to see what I can do.`;
        }
    } catch (error) {
        console.error(`❌ Error in generateResponse: ${error.message}\n${error.stack}`);
        return `Sorry, I encountered an error processing your request. Please try again.`;
    }
}

// Main webhook endpoint
app.post('/webhook', async (req, res) => {
    try {
        console.log(`📩 Received webhook request: ${JSON.stringify(req.body)}`);
        const incomingMessage = req.body.Body;
        const userPhone = req.body.From;

        if (!incomingMessage) {
            console.warn('⚠️ No message body received in webhook');
            throw new Error('No message body provided');
        }

        // Use Gemini to extract intent and entities
        let nluResult;
        try {
            nluResult = await getIntentAndEntities(incomingMessage);
            console.log(`✅ Gemini NLU result: ${JSON.stringify(nluResult)}`);
        } catch (error) {
            console.error(`❌ Error in Gemini NLU: ${error.message}\n${error.stack}`);
            nluResult = null;
        }

        let intent = nluResult?.intent || recognizeIntent(incomingMessage);
        let entities = nluResult?.entities || extractEntities(incomingMessage);

        // Fallback to local intent recognition if Gemini intent is unknown
        if (intent && !Object.keys(intentPatterns).includes(intent)) {
            console.warn(`⚠️ Gemini intent "${intent}" not found in intentPatterns, falling back to local recognition`);
            intent = recognizeIntent(incomingMessage);
        }

        let responseMessage = await generateResponse(intent, entities, userPhone);
        console.log(`📤 Generated response: ${responseMessage}`);

        // Sanitize responseMessage
        responseMessage = String(responseMessage)
            .replace(/[^\x09\x0A\x0D\x20-\x7F]/g, '')
            .replace(/[<>&'"]/g, '');

        // Twilio response
        const twiml = new twilio.twiml.MessagingResponse();
        twiml.message(responseMessage);
        console.log(`✅ Sending Twilio response: ${twiml.toString()}`);

        res.writeHead(200, { 'Content-Type': 'text/xml' });
        res.end(twiml.toString());
    } catch (error) {
        console.error(`❌ Webhook error: ${error.message}\n${error.stack}`);
        const errorResponse = new twilio.twiml.MessagingResponse();
        errorResponse.message("Sorry, I encountered an error. Please try again.");
        res.writeHead(200, { 'Content-Type': 'text/xml' });
        res.end(errorResponse.toString());
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    try {
        console.log('🔍 Health check requested');
        res.json({ 
            status: 'healthy', 
            timestamp: new Date().toISOString(),
            service: 'Askari WhatsApp Integration'
        });
    } catch (error) {
        console.error(`❌ Health check error: ${error.message}\n${error.stack}`);
        res.status(500).json({ 
            status: 'unhealthy', 
            error: error.message 
        });
    }
});

// Test API connection endpoint
app.get('/test-api', async (req, res) => {
    try {
        console.log('🧪 API test requested');
        const result = await guardTourAPI.testConnection();
        console.log(`✅ API test result: ${JSON.stringify(result)}`);
        res.json(result);
    } catch (error) {
        console.error(`❌ API test error: ${error.message}\n${error.stack}`);
        res.status(500).json({ 
            success: false, 
            message: 'API test failed',
            error: error.message 
        });
    }
});

// Start server
app.listen(port, () => {
    console.log(`🚀 Askari WhatsApp Integration Server running on port ${port}`);
    console.log(`📱 Webhook URL: http://localhost:${port}/webhook`);
    console.log(`🔍 Health check: http://localhost:${port}/health`);
    console.log(`🧪 API test: http://localhost:${port}/test-api`);
    
    guardTourAPI.testConnection()
        .then(result => {
            if (result.success) {
                console.log('✅ GuardTour API connection verified');
            } else {
                console.warn(`⚠️ GuardTour API connection issue: ${result.message}`);
            }
        })
        .catch(error => {
            console.error(`❌ Failed to test API connection: ${error.message}\n${error.stack}`);
        });
});