try {
                    const guardData = await guardTourAPI.getGuardInfo(entities.guardName);
                    return guardData.message;
                } catch (error) {
                    return `❌ Sorry, I couldn't fetch information for guard ${entities.guardName}. ${error.message}`;
                }// server.js - Updated WhatsApp Webhook Server with GuardTour API Integration
require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const GuardTourAPI = require('./askari-api');

const app = express();
const port = process.env.PORT || 3000;

// Initialize GuardTour API client
const guardTourAPI = new GuardTourAPI();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Enhanced intent patterns with more natural language variations
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
        /site (.*) info/i
    ],
    'guard_info': [
        /guard.*info.*for (.*)/i,
        /tell me about guard (.*)/i,
        /guard.*details.*(.*)/i,
        /info.*guard (.*)/i,
        /about guard (.*)/i,
        /guard (.*) info/i
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
        /stats/i
    ],
    'list_sites': [
        /list.*sites/i,
        /show.*all.*sites/i,
        /what.*sites/i,
        /sites.*list/i,
        /all.*sites/i
    ],
    'help': [
        /help/i,
        /what.*can.*do/i,
        /commands/i,
        /how.*use/i
    ]
};

// Enhanced entity extraction
function extractEntities(message) {
    const entities = {
        siteName: null,
        guardName: null,
        date: null,
        timeframe: null
    };

    // Extract site name (look for common site patterns)
    const siteMatches = message.match(/(?:site\s+)?([A-Za-z0-9\s]+?)(?:\s+(?:site|yesterday|today|report|info))/i);
    if (siteMatches) {
        entities.siteName = siteMatches[1].trim();
    }

    // Extract guard name
    const guardMatches = message.match(/guard\s+([A-Za-z\s]+?)(?:\s+(?:report|info|status))/i);
    if (guardMatches) {
        entities.guardName = guardMatches[1].trim();
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

    return entities;
}

// Intent recognition function
function recognizeIntent(message) {
    const normalizedMessage = message.toLowerCase().trim();
    
    for (const [intent, patterns] of Object.entries(intentPatterns)) {
        for (const pattern of patterns) {
            if (pattern.test(normalizedMessage)) {
                return intent;
            }
        }
    }
    
    return 'unknown';
}

// Enhanced response generation with real API calls
async function generateResponse(intent, entities, userPhone) {
    try {
        console.log(`🎯 Processing intent: ${intent}`, entities);

        switch (intent) {
            case 'patrol_report':
                if (!entities.siteName) {
                    return `📋 I can get patrol reports for you! Please specify which site you'd like to check.\n\nExample: "Show patrol report for Site Alpha"`;
                }
                
                try {
                    const patrolData = await guardTourAPI.getPatrolReports(entities.siteName, entities.date);
                    return patrolData.message;
                } catch (error) {
                    return `❌ Sorry, I couldn't fetch the patrol report for ${entities.siteName}. ${error.message}`;
                }

            case 'site_info':
                if (!entities.siteName) {
                    return `🏢 I can provide site information! Please specify which site you'd like to know about.\n\nExample: "Tell me about Site Alpha"`;
                }
                
                try {
                    const siteData = await guardTourAPI.getSiteInfo(entities.siteName);
                    return siteData.message;
                } catch (error) {
                    return `❌ Sorry, I couldn't fetch information for ${entities.siteName}. ${error.message}`;
                }

            case 'guard_info':
                if (!entities.guardName) {
                    return `👮 I can provide guard information! Please specify which guard you'd like to know about.\n\nExample: "Tell me about guard John"`;
                }
                
                try {
                    const guardData = await askariAPI.getGuardInfo(entities.guardName);
                    return guardData.message;
                } catch (error) {
                    return `❌ Sorry, I couldn't fetch information for guard ${entities.guardName}. ${error.message}`;
                }

            case 'incident_report':
                try {
                    const incidentData = await askariAPI.getIncidentReports(entities.siteName, entities.date);
                    return incidentData.message;
                } catch (error) {
                    return `❌ Sorry, I couldn't fetch incident reports. ${error.message}`;
                }

            case 'list_sites':
                try {
                    const sites = await askariAPI.getAllSites();
                    if (sites && sites.length > 0) {
                        let message = `🏢 **All Sites:**\n\n`;
                        sites.forEach((site, index) => {
                            message += `${index + 1}. ${site.name}`;
                            if (site.status) message += ` (${site.status})`;
                            message += `\n`;
                        });
                        return message;
                    } else {
                        return `No sites found in the system.`;
                    }
                } catch (error) {
                    return `❌ Sorry, I couldn't fetch the sites list. ${error.message}`;
                }

            case 'help':
                return `🤖 **Askari WhatsApp Assistant**\n\nI can help you with:\n\n📋 **Patrol Reports**\n"Show patrol report for Site Alpha"\n"Get patrol status for Site Beta"\n\n🏢 **Site Information**\n"Tell me about Site Alpha"\n"Site info for Site Beta"\n\n👮 **Guard Information**\n"Guard info for John"\n"Tell me about guard Mary"\n\n🚨 **Incident Reports**\n"Show incidents for Site Alpha"\n"Get incident reports"\n\n📋 **List All Sites**\n"List all sites"\n"Show all sites"\n\nJust ask me naturally - I understand various ways of asking!`;

            default:
                return `I didn't understand that request. Type "help" to see what I can do for you.`;
        }
    } catch (error) {
        console.error('❌ Error in generateResponse:', error);
        return `Sorry, I encountered an error processing your request. Please try again.`;
    }
}

// Main webhook endpoint
app.post('/webhook', async (req, res) => {
    try {
        console.log('📨 Received WhatsApp message:', {
            from: req.body.From,
            message: req.body.Body,
            profileName: req.body.ProfileName
        });

        const incomingMessage = req.body.Body;
        const userPhone = req.body.From;
        
        // Recognize intent and extract entities
        const intent = recognizeIntent(incomingMessage);
        const entities = extractEntities(incomingMessage);
        
        console.log('🧠 Recognized:', { intent, entities });
        
        // Generate response using real API data
        const responseMessage = await generateResponse(intent, entities, userPhone);
        
        // Create Twilio response
        const twiml = new twilio.twiml.MessagingResponse();
        twiml.message(responseMessage);
        
        console.log('✅ Sending response:', responseMessage.substring(0, 100) + '...');
        
        res.writeHead(200, {'Content-Type': 'text/xml'});
        res.end(twiml.toString());
        
    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        
        const errorResponse = new twilio.twiml.MessagingResponse();
        errorResponse.message('Sorry, I encountered an error. Please try again.');
        
        res.writeHead(200, {'Content-Type': 'text/xml'});
        res.end(errorResponse.toString());
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'Askari WhatsApp Integration'
    });
});

// Test API connection endpoint
app.get('/test-api', async (req, res) => {
    try {
        const result = await askariAPI.testConnection();
        res.json(result);
    } catch (error) {
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
    
    // Test API connection on startup
    askariAPI.testConnection()
        .then(result => {
            if (result.success) {
                console.log('✅ Askari API connection verified');
            } else {
                console.warn('⚠️  Askari API connection issue:', result.message);
            }
        })
        .catch(error => {
            console.error('❌ Failed to test API connection:', error.message);
        });
});