// askari-api.js - GuardTour API Integration Module
const axios = require('axios');

class GuardTourAPI {
    constructor() {
        // Configure your GuardTour API base URL and authentication
        this.baseURL = process.env.ASKARI_API_URL || 'https://guardtour.legitsystemsug.com';
        this.authToken = process.env.ASKARI_AUTH_TOKEN;
        
        // Create axios instance with default configuration
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 10000, // 10 second timeout
            headers: {
                'Authorization': `Bearer ${this.authToken}`,
                'Content-Type': 'application/json'
            }
        });

        // Add request interceptor for logging
        this.client.interceptors.request.use(
            (config) => {
                console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                console.error('❌ API Request Error:', error);
                return Promise.reject(error);
            }
        );

        // Add response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => {
                console.log(`✅ API Response: ${response.status} ${response.config.url}`);
                return response;
            },
            (error) => {
                console.error('❌ API Response Error:', error.response?.status, error.response?.data);
                return Promise.reject(error);
            }
        );
    }

    // Get patrol reports for a specific site
    async getPatrolReports(siteName, date = null) {
        try {
            // First, find the site by name to get its ID
            const site = await this.findSiteByName(siteName);
            if (!site) {
                return {
                    message: `Site "${siteName}" not found. Please check the site name and try again.`,
                    hasData: false
                };
            }

            // Get patrols for this site
            const response = await this.client.get(`/sites/${site.id}/patrols`);
            return this.formatPatrolReports(response.data.data, siteName); // Use .data
        } catch (error) {
            console.error('❌ Error fetching patrol reports:', error.message);
            throw new Error('Failed to fetch patrol reports. Please try again.');
        }
    }

    // Get site information
    async getSiteInfo(siteName) {
        try {
            const site = await this.findSiteByName(siteName);
            if (!site) {
                return {
                    message: `Site "${siteName}" not found. Please check the site name and try again.`,
                    hasData: false
                };
            }

            // Get detailed site information
            const response = await this.client.get(`/sites/${site.id}`);
            return this.formatSiteInfo(response.data.data); // Use .data
        } catch (error) {
            console.error('❌ Error fetching site info:', error.message);
            throw new Error('Failed to fetch site information. Please try again.');
        }
    }

    // Get guard information
    async getGuardInfo(guardName) {
        try {
            // Get all security guards and find by name
            const response = await this.client.get('/users/security-guards');
            const guards = response.data;
            
            const guard = guards.find(g => 
                g.name?.toLowerCase().includes(guardName.toLowerCase()) ||
                g.firstName?.toLowerCase().includes(guardName.toLowerCase()) ||
                g.lastName?.toLowerCase().includes(guardName.toLowerCase())
            );

            if (!guard) {
                return {
                    message: `Guard "${guardName}" not found. Please check the name and try again.`,
                    hasData: false
                };
            }

            return this.formatGuardInfo(guard);
        } catch (error) {
            console.error('❌ Error fetching guard info:', error.message);
            throw new Error('Failed to fetch guard information. Please try again.');
        }
    }

    // Get site performance/incidents (using performance endpoint)
    async getSitePerformance(siteName, timeframe = 'today') {
        try {
            const site = await this.findSiteByName(siteName);
            if (!site) {
                return {
                    message: `Site "${siteName}" not found. Please check the site name and try again.`,
                    hasData: false
                };
            }

            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const day = now.getDate();

            let response;
            if (timeframe === 'today') {
                response = await this.client.get(`/sites/${site.id}/${year}/${month}/${day}/performance`);
            } else {
                response = await this.client.get(`/sites/${site.id}/${year}/${month}/performance`);
            }

            return this.formatPerformanceReport(response.data.data, siteName, timeframe); // Use .data
        } catch (error) {
            console.error('❌ Error fetching site performance:', error.message);
            throw new Error('Failed to fetch site performance data. Please try again.');
        }
    }

    // Get all sites
    async getAllSites() {
        try {
            const response = await this.client.get('/sites');
            return response.data.data; // Return the array directly
        } catch (error) {
            console.error('❌ Error fetching sites:', error.message);
            throw new Error('Failed to fetch sites list. Please try again.');
        }
    }

    // Get system stats
    async getSystemStats() {
        try {
            const response = await this.client.get('/stats');
            return this.formatSystemStats(response.data);
        } catch (error) {
            console.error('❌ Error fetching system stats:', error.message);
            throw new Error('Failed to fetch system statistics. Please try again.');
        }
    }

    // Helper method to find site by name
    async findSiteByName(siteName) {
        try {
            const response = await this.client.get('/sites');
            const sites = response.data.data; // <-- FIXED: use .data.data

            // Use case-insensitive, trimmed comparison
            return sites.find(site =>
                site.name && site.name.trim().toLowerCase() === siteName.trim().toLowerCase()
            );
        } catch (error) {
            console.error('❌ Error finding site:', error.message);
            return null;
        }
    }

    // Format patrol reports for WhatsApp display
    formatPatrolReports(data, siteName) {
        if (!data || !data.length) {
            return {
                message: `No patrol reports found for ${siteName}.`,
                hasData: false
            };
        }

        let message = `📋 **Patrol Reports - ${siteName}**\n\n`;
        
        data.slice(0, 5).forEach((patrol, index) => { // Limit to 5 most recent
            message += `**Patrol ${index + 1}:**\n`;
            message += `👮 Guard: ${patrol.guardName || patrol.guard?.name || 'N/A'}\n`;
            message += `⏰ Time: ${this.formatDateTime(patrol.timestamp || patrol.createdAt)}\n`;
            message += `📍 Status: ${patrol.status || 'Completed'}\n`;
            
            if (patrol.location) {
                message += `🗺️ Location: ${patrol.location}\n`;
            }
            
            if (patrol.notes || patrol.description) {
                message += `📝 Notes: ${patrol.notes || patrol.description}\n`;
            }
            
            message += `\n---\n\n`;
        });

        if (data.length > 5) {
            message += `📊 Showing 5 of ${data.length} patrol reports.`;
        }

        return {
            message: message.trim(),
            hasData: true,
            count: data.length
        };
    }

    // Format site information for WhatsApp display
    formatSiteInfo(data) {
        if (!data) {
            return {
                message: "Site information not found.",
                hasData: false
            };
        }

        let message = `🏢 **Site Information**\n\n`;
        message += `**Name:** ${data.name || data.title || 'N/A'}\n`;
        message += `**Location:** ${data.address || data.location || 'N/A'}\n`;
        message += `**Status:** ${data.status || data.isActive ? '✅ Active' : '❌ Inactive'}\n`;
        
        if (data.description) {
            message += `**Description:** ${data.description}\n`;
        }
        
        if (data.contactPerson || data.contact) {
            message += `**Contact:** ${data.contactPerson || data.contact}\n`;
        }
        
        if (data.phone || data.phoneNumber) {
            message += `**Phone:** ${data.phone || data.phoneNumber}\n`;
        }

        if (data.company) {
            message += `**Company:** ${data.company.name || data.company}\n`;
        }

        return {
            message: message,
            hasData: true,
            data: data
        };
    }

    // Format guard information for WhatsApp display
    formatGuardInfo(data) {
        if (!data) {
            return {
                message: "Guard information not found.",
                hasData: false
            };
        }

        let message = `👮 **Guard Information**\n\n`;
        message += `**Name:** ${data.firstName || ''} ${data.lastName || data.name || 'N/A'}\n`;
        message += `**ID:** ${data.id || data.guardId || 'N/A'}\n`;
        message += `**Email:** ${data.email || 'N/A'}\n`;
        message += `**Status:** ${data.isActive ? '✅ Active' : '❌ Inactive'}\n`;
        
        if (data.phone || data.phoneNumber) {
            message += `**Phone:** ${data.phone || data.phoneNumber}\n`;
        }

        if (data.currentSite) {
            message += `**Current Site:** ${data.currentSite}\n`;
        }

        if (data.company) {
            message += `**Company:** ${data.company.name || data.company}\n`;
        }

        return {
            message: message,
            hasData: true,
            data: data
        };
    }

    // Format performance report for WhatsApp display
    formatPerformanceReport(data, siteName, timeframe) {
        if (!data) {
            return {
                message: `No performance data found for ${siteName}.`,
                hasData: false
            };
        }

        let message = `📊 **Performance Report - ${siteName}**\n`;
        message += `⏰ Period: ${timeframe === 'today' ? 'Today' : 'This Month'}\n\n`;
        
        if (data.totalPatrols !== undefined) {
            message += `🚶 Total Patrols: ${data.totalPatrols}\n`;
        }
        
        if (data.completedPatrols !== undefined) {
            message += `✅ Completed: ${data.completedPatrols}\n`;
        }
        
        if (data.missedPatrols !== undefined) {
            message += `❌ Missed: ${data.missedPatrols}\n`;
        }
        
        if (data.averageResponse !== undefined) {
            message += `⏱️ Avg Response: ${data.averageResponse}\n`;
        }

        return {
            message: message,
            hasData: true,
            data: data
        };
    }

    // Format system stats for WhatsApp display
    formatSystemStats(data) {
        if (!data) {
            return {
                message: "System statistics not available.",
                hasData: false
            };
        }

        let message = `📈 **System Statistics**\n\n`;
        
        if (data.totalSites !== undefined) {
            message += `🏢 Total Sites: ${data.totalSites}\n`;
        }
        
        if (data.totalGuards !== undefined) {
            message += `👮 Total Guards: ${data.totalGuards}\n`;
        }
        
        if (data.activePatrols !== undefined) {
            message += `🚶 Active Patrols: ${data.activePatrols}\n`;
        }
        
        if (data.todayPatrols !== undefined) {
            message += `📅 Today's Patrols: ${data.todayPatrols}\n`;
        }

        return {
            message: message,
            hasData: true,
            data: data
        };
    }

    // Helper method to format date and time
    formatDateTime(dateString) {
        if (!dateString) return 'N/A';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return dateString;
        }
    }

    // Test API connection
    async testConnection() {
        try {
            const response = await this.client.get('/stats');
            console.log('✅ API Connection successful');
            return { success: true, message: 'API connection successful' };
        } catch (error) {
            console.error('❌ API Connection failed:', error.message);
            return { success: false, message: 'API connection failed' };
        }
    }
}

module.exports = GuardTourAPI;