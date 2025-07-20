import axios from "axios";
import AuthTokenManager from "./auth-token-manager.js";

const authTokenManager = await AuthTokenManager.create("./token.json");

export default class GuardTourAPI {
    baseURL = 'https://guardtour.legitsystemsug.com';
    constructor(username, password) {
        try {
            console.log('🔧 Initializing GuardTourAPI client');
            this.authTokenManager = authTokenManager;
            this.username = username;
            this.password = password;
            this.responseTimeout = 10000;

            this.authorizedClient = axios.create({
                baseURL: this.baseURL,
                timeout: this.responseTimeout,
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            this.unauthorizedClient = axios.create({
                baseURL: this.baseURL,
                timeout: this.responseTimeout,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Request interceptor
            axios.interceptors.request.use(
                (config) => {
                    console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url} ${JSON.stringify(config.params || {})}`);
                    return config;
                },
                (error) => {
                    console.error(`❌ API Request Error: ${error.message}\n${error.stack}`);
                    return Promise.reject(error);
                }
            );

            // Response interceptor
            axios.interceptors.response.use(
                (response) => {
                    console.log(`✅ API Response: ${response.status} ${response.config.url} ${JSON.stringify(response.data).slice(0, 100)}...`);
                    return response;
                },
                (error) => {
                    console.error(`❌ API Response Error: ${error.response?.status} ${error.response?.data?.message || error.message}\n${error.stack}`);
                    return Promise.reject(error);
                }
            );

            // Authentication token interceptor
            this.authorizedClient.interceptors.request.use(async (config) => {
                try {
                    console.log('🔐 Checking auth token');
                    let token;
                    if (await this.authTokenManager.isExpired()) {
                        console.log('🔄 Token expired, authenticating...');
                        token = await this.authenticate();
                        await this.authTokenManager.save(token);
                    } else {
                        token = await this.authTokenManager.read();
                    }
                    config.headers.Authorization = `Bearer ${token}`;
                    console.log('✅ Token applied to request');
                    return config;
                } catch (error) {
                    console.error(`❌ Token interceptor error: ${error.message}\n${error.stack}`);
                    throw error;
                }
            }, error => {
                console.error(`❌ Token interceptor error: ${error.message}\n${error.stack}`);
                return Promise.reject(error);
            });
        } catch (error) {
            console.error(`❌ Error initializing GuardTourAPI: ${error.message}\n${error.stack}`);
            throw error;
        }
    }

    async authenticate() {
        try {
            console.log('🔐 Attempting authentication');
            const response = await axios.post(`${this.baseURL}/auth/signin`, {username: this.username, password: this.password});
            console.log('✅ Authentication successful');
            return response.data["access_token"];
        } catch (error) {
            console.error(`❌ Authentication error: ${error.message}\n${error.stack}`);
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    async getPatrolReports(siteName, startDate = null, endDate = null) {
        try {
            console.log(`📋 Fetching patrol reports for ${siteName}, start: ${startDate}, end: ${endDate}`);
            const site = await this.findSiteByName(siteName);
            if (!site) {
                console.warn(`⚠️ Site "${siteName}" not found`);
                return {
                    message: `Site "${siteName}" not found.`,
                    hasData: false
                };
            }
            let params = { limit: 50 };
            if (startDate) params["filter.date"] = `$gte:${startDate}`;
            if (endDate) params["filter.date"] = `${params["filter.date"] || ''}$lte:${endDate}`;
            const response = await this.unauthorizedClient.get(`/sites/${site.id}/patrols`, { params });
            console.log(`✅ Patrol reports fetched: ${response.data.data.length} items`);
            return this.formatPatrolReports(response.data.data, siteName);
        } catch (error) {
            console.error(`❌ Error fetching patrol reports for ${siteName}: ${error.message}\n${error.stack}`);
            throw new Error(`Failed to fetch patrol reports: ${error.message}`);
        }
    }

    async getSiteInfo(siteName) {
        try {
            console.log(`🏢 Fetching site info for ${siteName}`);
            const site = await this.findSiteByName(siteName);
            if (!site) {
                console.warn(`⚠️ Site "${siteName}" not found`);
                return {
                    message: `Site "${siteName}" not found.`,
                    hasData: false
                };
            }
            console.log(`✅ Site info fetched for ${siteName}`);
            return this.formatSiteInfo(site);
        } catch (error) {
            console.error(`❌ Error fetching site info for ${siteName}: ${error.message}\n${error.stack}`);
            throw new Error(`Failed to fetch site information: ${error.message}`);
        }
    }

    async getGuardByName(guardName) {
        try {
            console.log(`👮 Searching for guard: ${guardName}`);
            const response = await this.authorizedClient.get('/users/security-guards', {params: {search: guardName, limit: 100}});
            const guards = response.data.data.map(guard => ({...guard, fullName: `${guard.firstName} ${guard.lastName}`}));
            const guard = guards.find(guard => guard.fullName.toLowerCase().includes(guardName.toLowerCase()));
            console.log(`✅ Guard search completed, found: ${guard ? guard.fullName : 'none'}`);
            return guard;
        } catch (error) {
            console.error(`❌ Error searching guard ${guardName}: ${error.message}\n${error.stack}`);
            throw new Error(`Failed to search guard: ${error.message}`);
        }
    }

    async getGuardInfo(guardName) {
        try {
            console.log(`👮 Fetching guard info for ${guardName}`);
            const guard = await this.getGuardByName(guardName);
            if (!guard) {
                console.warn(`⚠️ Guard "${guardName}" not found`);
                return {
                    message: `Guard "${guardName}" not found.`,
                    hasData: false
                };
            }
            console.log(`✅ Guard info fetched for ${guardName}`);
            return this.formatGuardInfo(guard);
        } catch (error) {
            console.error(`❌ Error fetching guard info for ${guardName}: ${error.message}\n${error.stack}`);
            throw new Error(`Failed to fetch guard information: ${error.message}`);
        }
    }

    async getSitePerformance(siteName, year = null, month = null, day = null) {
        try {
            console.log(`📊 Fetching site performance for ${siteName}, ${year}-${month}${day ? '-' + day : ''}`);
            const site = await this.findSiteByName(siteName);
            if (!site) {
                console.warn(`⚠️ Site "${siteName}" not found`);
                return {
                    message: `Site "${siteName}" not found.`,
                    hasData: false
                };
            }

            const now = new Date();
            year = year || now.getFullYear();
            month = month || now.getMonth() + 1;
            
            let endpoint = `/sites/${site.id}/${year}/${month}/performance`;
            let timeframe = 'this_month';
            if (day) {
                endpoint = `/sites/${site.id}/${year}/${month}/${day}/performance`;
                timeframe = 'today';
            }

            const response = await this.authorizedClient.get(endpoint, { params: { limit: 50 } });
            console.log(`✅ Site performance fetched for ${siteName}`);
            return this.formatPerformanceReport(response.data.data, siteName, timeframe);
        } catch (error) {
            console.error(`❌ Error fetching site performance for ${siteName}: ${error.message}\n${error.stack}`);
            throw new Error(`Failed to fetch site performance: ${error.message}`);
        }
    }

    async getAllSites() {
        try {
            console.log('🏢 Fetching all sites');
            const response = await this.authorizedClient.get('/sites', { params: { limit: 100 } });
            console.log(`✅ Fetched ${response.data.data.length} sites`);
            return response.data.data;
        } catch (error) {
            console.error(`❌ Error fetching sites: ${error.message}\n${error.stack}`);
            throw new Error(`Failed to fetch sites list: ${error.message}`);
        }
    }

    async getSystemStats() {
        try {
            console.log('📈 Fetching system stats');
            const response = await this.authorizedClient.get('/stats');
            console.log('✅ System stats fetched');
            return this.formatSystemStats(response.data);
        } catch (error) {
            console.error(`❌ Error fetching system stats: ${error.message}\n${error.stack}`);
            throw new Error(`Failed to fetch system stats: ${error.message}`);
        }
    }

    async getCallLogsForSite(siteName, params = { limit: 50 }) {
        try {
            console.log(`📞 Fetching call logs for ${siteName}`);
            const site = await this.findSiteByName(siteName);
            if (!site) {
                console.warn(`⚠️ Site "${siteName}" not found`);
                return { message: `Site "${siteName}" not found.`, hasData: false };
            }
            const response = await this.authorizedClient.get(`/sites/${site.id}/call-logs`, { params });
            console.log(`✅ Fetched ${response.data.data.length} call logs for ${siteName}`);
            return this.formatCallLogs(response.data.data, siteName);
        } catch (error) {
            console.error(`❌ Error fetching call logs for ${siteName}: ${error.message}\n${error.stack}`);
            throw new Error(`Failed to fetch call logs: ${error.message}`);
        }
    }

    async getShiftsForSite(siteName, params = { limit: 50 }) {
        try {
            console.log(`🕒 Fetching shifts for ${siteName}`);
            const site = await this.findSiteByName(siteName);
            if (!site) {
                console.warn(`⚠️ Site "${siteName}" not found`);
                return { message: `Site "${siteName}" not found.`, hasData: false };
            }
            const response = await this.authorizedClient.get(`/sites/${site.id}/shifts`, { params });
            console.log(`✅ Fetched ${response.data.length} shifts for ${siteName}`);
            return this.formatShifts(response.data, siteName);
        } catch (error) {
            console.error(`❌ Error fetching shifts for ${siteName}: ${error.message}\n${error.stack}`);
            throw new Error(`Failed to fetch shifts: ${error.message}`);
        }
    }

    async getNotificationsForSite(siteName, params = { limit: 50 }) {
        try {
            console.log(`🔔 Fetching notifications for ${siteName}`);
            const site = await this.findSiteByName(siteName);
            if (!site) {
                console.warn(`⚠️ Site "${siteName}" not found`);
                return { message: `Site "${siteName}" not found.`, hasData: false };
            }
            const response = await this.authorizedClient.get(`/sites/${site.id}/notifications`, { params });
            console.log(`✅ Fetched ${response.data.data.length} notifications for ${siteName}`);
            return this.formatNotifications(response.data.data, siteName);
        } catch (error) {
            console.error(`❌ Error fetching notifications for ${siteName}: ${error.message}\n${error.stack}`);
            throw new Error(`Failed to fetch notifications: ${error.message}`);
        }
    }

    async getGuardPerformance(guardName, startDate = null, endDate = null) {
        try {
            console.log(`📊 Fetching guard performance for ${guardName}, start: ${startDate}, end: ${endDate}`);
            const guard = await this.getGuardByName(guardName);
            if (!guard) {
                console.warn(`⚠️ Guard "${guardName}" not found`);
                return { message: `Guard "${guardName}" not found.`, hasData: false };
            }
            let params = { limit: 50 };
            if (startDate) params["filter.date"] = `$gte:${startDate}`;
            if (endDate) params["filter.date"] = `${params["filter.date"] || ''}$lte:${endDate}`;
            const response = await this.authorizedClient.get(`/users/security-guards/${guard.id}/patrols`, { params });
            const site = guard.currentSite ? await this.findSiteByName(guard.currentSite) : null;
            const performance = site ? await this.getSitePerformance(site.name) : { data: {} };
            console.log(`✅ Guard performance fetched for ${guardName}`);
            return this.formatGuardPerformance(response.data.data, performance.data, guardName);
        } catch (error) {
            console.error(`❌ Error fetching guard performance for ${guardName}: ${error.message}\n${error.stack}`);
            throw new Error(`Failed to fetch guard performance: ${error.message}`);
        }
    }

    async findSiteByName(siteName) {
        try {
            console.log(`🔍 Finding site: ${siteName}`);
            const response = await this.authorizedClient.get('/sites', {params: {search: siteName, limit: 100}});
            const sites = response.data.data;
            const site = sites.find(site => site.name && site.name.trim().toLowerCase() === siteName.trim().toLowerCase());
            console.log(`✅ Site search completed, found: ${site ? site.name : 'none'}`);
            return site;
        } catch (error) {
            console.error(`❌ Error finding site ${siteName}: ${error.message}\n${error.stack}`);
            return null;
        }
    }

    formatPatrolReports(data, siteName) {
        try {
            console.log(`📋 Formatting ${data?.length || 0} patrol reports for ${siteName}`);
            if (!data || !data.length) {
                console.warn(`⚠️ No patrol reports found for ${siteName}`);
                return {
                    message: `No patrol reports found for ${siteName}.`,
                    hasData: false
                };
            }

            let message = `📋 **Patrol Reports - ${siteName}**\n\n`;
            data.slice(0, 5).forEach((patrol, index) => {
                const guardName = patrol?.securityGuard ? `${patrol.securityGuard.firstName} ${patrol.securityGuard.lastName}` : null;
                message += `**Patrol ${index + 1}:**\n`;
                message += `👮 Guard: ${guardName || 'N/A'}\n`;
                message += `👮 Guard Tag: ${patrol.securityGuardUniqueId || 'N/A'}\n`;
                message += `⏰ Time: ${this.formatDateTime(`${patrol.date}T${patrol.startTime}`)}\n`;
                message += `📍 Status: ${patrol.status || 'Completed'}\n`;
                if (patrol.location) message += `🗺️ Location: ${patrol.location}\n`;
                if (patrol.notes || patrol.description) message += `📝 Notes: ${patrol.notes || patrol.description}\n`;
                message += `\n---\n\n`;
            });

            if (data.length > 5) {
                message += `📊 Showing 5 of ${data.length} patrol reports.`;
            }

            console.log(`✅ Formatted patrol reports for ${siteName}`);
            return {
                message: message.trim(),
                hasData: true,
                count: data.length
            };
        } catch (error) {
            console.error(`❌ Error formatting patrol reports for ${siteName}: ${error.message}\n${error.stack}`);
            throw new Error(`Failed to format patrol reports: ${error.message}`);
        }
    }

    formatSiteInfo(data) {
        try {
            console.log(`🏢 Formatting site info for ${data?.name || 'unknown'}`);
            if (!data) {
                console.warn('⚠️ No site data provided');
                return {
                    message: "Site information not found.",
                    hasData: false
                };
            }

            let message = `🏢 *Site Information*\n\n`;
            message += `*Name:* ${data.name || 'N/A'}\n`;
            message += `*Company:* ${data.company?.name || data.company || 'N/A'}\n`;
            message += `*Site Tag:* ${data.tagId || 'N/A'}\n`;
            message += `*Phone:* ${data.phone || data.phoneNumber || 'N/A'}\n`;
            message += `*Latitude:* ${data.latitude || 'N/A'}\n`;
            message += `*Longitude:* ${data.longitude || 'N/A'}\n`;
            message += `*Required Patrols Per Guard:* ${data.requiredPatrolsPerGuard || 'N/A'}\n`;
            message += `*Notifications Cycle:* ${data.notificationCycle || 'N/A'}\n`;
            if (data.description) message += `*Description:* ${data.description}\n`;
            if (data.contactPerson || data.contact) message += `*Contact:* ${data.contactPerson || data.contact}\n`;

            console.log(`✅ Formatted site info for ${data.name}`);
            return {
                message: message.trim(),
                hasData: true,
                data: data
            };
        } catch (error) {
            console.error(`❌ Error formatting site info: ${error.message}\n${error.stack}`);
            throw new Error(`Failed to format site info: ${error.message}`);
        }
    }

    formatGuardInfo(data) {
        try {
            console.log(`👮 Formatting guard info for ${data?.firstName || 'unknown'} ${data?.lastName || ''}`);
            if (!data) {
                console.warn('⚠️ No guard data provided');
                return {
                    message: "Guard information not found.",
                    hasData: false
                };
            }

            let message = `👮 *Guard Information*\n\n`;
            message += `*Name:* ${data.firstName || ''} ${data.lastName || data.name || 'N/A'}\n`;
            message += `*ID:* ${data.id || data.guardId || 'N/A'}\n`;
            message += `*Unique ID:* ${data.uniqueId || 'N/A'}\n`;
            message += `*Gender:* ${data.gender || 'N/A'}\n`;
            message += `*Date of Birth:* ${data.dateOfBirth || 'N/A'}\n`;
            message += `*Type:* ${data.type || 'N/A'}\n`;
            message += `*Phone:* ${data.phone || data.phoneNumber || 'N/A'}\n`;
            message += `*Company:* ${data.company?.name || data.company || 'N/A'}\n`;

            console.log(`✅ Formatted guard info for ${data.firstName} ${data.lastName}`);
            return {
                message: message.trim(),
                hasData: true,
                data: data
            };
        } catch (error) {
            console.error(`❌ Error formatting guard info: ${error.message}\n${error.stack}`);
            throw new Error(`Failed to format guard info: ${error.message}`);
        }
    }

    formatPerformanceReport(data, siteName, timeframe) {
        try {
            console.log(`📊 Formatting performance report for ${siteName}, timeframe: ${timeframe}`);
            if (!data) {
                console.warn(`⚠️ No performance data for ${siteName}`);
                return {
                    message: `No performance data found for ${siteName}.`,
                    hasData: false
                };
            }

            let message = `📊 **Performance Report - ${siteName}**\n`;
            message += `⏰ Period: ${timeframe === 'today' ? 'Today' : 'This Month'}\n\n`;
            if (data.totalPatrols !== undefined) message += `🚶 Total Patrols: ${data.totalPatrols}\n`;
            if (data.completedPatrols !== undefined) message += `✅ Completed: ${data.completedPatrols}\n`;
            if (data.missedPatrols !== undefined) message += `❌ Missed: ${data.missedPatrols}\n`;
            if (data.averageResponse !== undefined) message += `⏱️ Avg Response: ${data.averageResponse}\n`;

            console.log(`✅ Formatted performance report for ${siteName}`);
            return {
                message: message,
                hasData: true,
                data: data
            };
        } catch (error) {
            console.error(`❌ Error formatting performance report for ${siteName}: ${error.message}\n${error.stack}`);
            throw new Error(`Failed to format performance report: ${error.message}`);
        }
    }

    formatSystemStats(data) {
        try {
            console.log('📈 Formatting system stats');
            if (!data) {
                console.warn('⚠️ No system stats data provided');
                return {
                    message: "System statistics not available.",
                    hasData: false
                };
            }

            let message = `📈 **System Statistics**\n\n`;
            if (data.siteCount !== undefined) message += `🏢 Total Sites: ${data.siteCount}\n`;
            if (data.securityGuardCount !== undefined) message += `👮 Total Guards: ${data.securityGuardCount}\n`;
            if (data.companyAdminCount !== undefined) message += `🚶 Company Administrators: ${data.companyAdminCount}\n`;
            if (data.companyCount !== undefined) message += `✅ Company Count: ${data.companyCount}\n`;

            console.log('✅ Formatted system stats');
            return {
                message: message,
                hasData: true,
                data: data
            };
        } catch (error) {
            console.error(`❌ Error formatting system stats: ${error.message}\n${error.stack}`);
            throw new Error(`Failed to format system stats: ${error.message}`);
        }
    }

    formatCallLogs(data, siteName) {
        try {
            console.log(`📞 Formatting ${data?.length || 0} call logs for ${siteName}`);
            if (!data || !data.length) {
                console.warn(`⚠️ No call logs found for ${siteName}`);
                return {
                    message: `No call logs found for ${siteName}.`,
                    hasData: false
                };
            }

            let message = `📞 **Call Logs - ${siteName}**\n\n`;
            data.slice(0, 5).forEach((log, index) => {
                message += `**Call ${index + 1}:**\n`;
                message += `📅 Date: ${this.formatDateTime(log.date)}\n`;
                message += `⏱️ Time: ${log.time || 'N/A'}\n`;
                message += `👮 Guard: ${log.answeredBy || 'N/A'}\n`;
                message += `📱 Site: ${log.site.title || log.site.name}\n`;
                if (log.notes) message += `📝 Notes: ${log.notes}\n`;
                message += `\n---\n\n`;
            });

            if (data.length > 5) {
                message += `📊 Showing 5 of ${data.length} call logs.`;
            }

            console.log(`✅ Formatted call logs for ${siteName}`);
            return {
                message: message.trim(),
                hasData: true,
                count: data.length
            };
        } catch (error) {
            console.error(`❌ Error formatting call logs for ${siteName}: ${error.message}\n${error.stack}`);
            throw new Error(`Failed to format call logs: ${error.message}`);
        }
    }

    formatShifts(data, siteName) {
        try {
            console.log(`🕒 Formatting ${data?.length || 0} shifts for ${siteName}`);
            if (!data || !data.length) {
                console.warn(`⚠️ No shifts found for ${siteName}`);
                return {
                    message: `No shifts found for ${siteName}.`,
                    hasData: false
                };
            }

            let message = `🕒 **Shifts - ${siteName}**\n\n`;
            data.slice(0, 5).forEach((shift, index) => {
                message += `Shift keys: ${Object.keys(shift).join(", ")}`;
                message += `**Shift ${index + 1}:**\n`;
                message += `👮 Guard(s): ${shift.securityGuards.map(guard => `${guard.firstName} ${guard.lastName}`).join(", ")}\n`;
                message += `✅ Type: ${shift.type}\n`;
                message += `📍 Site: ${shift.site.name || 'N/A'}\n`;
                if (shift.notes) message += `📝 Notes: ${shift.notes}\n`;
                message += `\n---\n\n`;
            });

            if (data.length > 5) {
                message += `📊 Showing 5 of ${data.length} shifts.`;
            }

            console.log(`✅ Formatted shifts for ${siteName}`);
            return {
                message: message.trim(),
                hasData: true,
                count: data.length
            };
        } catch (error) {
            console.error(`❌ Error formatting shifts for ${siteName}: ${error.message}\n${error.stack}`);
            throw new Error(`Failed to format shifts: ${error.message}`);
        }
    }

    formatNotifications(data, siteName) {
        try {
            console.log(`🔔 Formatting ${data?.length || 0} notifications for ${siteName}`);
            if (!data || !data.length) {
                console.warn(`⚠️ No notifications found for ${siteName}`);
                return {
                    message: `No notifications found for ${siteName}.`,
                    hasData: false
                };
            }

            let message = `🔔 **Notifications - ${siteName}**\n\n`;
            data.slice(0, 5).forEach((notification, index) => {
                message += `**Notification ${index + 1}:**\n`;
                message += `📅 Date: ${this.formatDateTime(notification.dateCreatedAt)}\n`;
                message += `📅 Time: ${notification.timeCreatedAt}\n`;
                message += `📝 Site: ${notification.site.name || notification.site.title}\n`;
                message += `\n---\n\n`;
            });

            if (data.length > 5) {
                message += `📊 Showing 5 of ${data.length} notifications.`;
            }

            console.log(`✅ Formatted notifications for ${siteName}`);
            return {
                message: message.trim(),
                hasData: true,
                count: data.length
            };
        } catch (error) {
            console.error(`❌ Error formatting notifications for ${siteName}: ${error.message}\n${error.stack}`);
            throw new Error(`Failed to format notifications: ${error.message}`);
        }
    }

    formatGuardPerformance(patrolData, performanceData, guardName) {
        try {
            console.log(`📊 Formatting guard performance for ${guardName}`);
            if (!patrolData || !patrolData.length) {
                console.warn(`⚠️ No patrol data for guard ${guardName}`);
                return {
                    message: `No performance data found for guard ${guardName}.`,
                    hasData: false
                };
            }

            let message = `📊 **Guard Performance - ${guardName}**\n\n`;
            message += `🚶 Total Patrols: ${patrolData.length}\n`;
            message += `✅ Completed: ${patrolData.filter(p => p.status === 'Completed').length}\n`;
            message += `❌ Missed: ${patrolData.filter(p => p.status === 'Missed').length}\n`;
            if (performanceData.averageResponse) {
                message += `⏱️ Avg Response: ${performanceData.averageResponse}\n`;
            }
            patrolData.slice(0, 3).forEach((patrol, index) => {
                message += `\n**Patrol ${index + 1}:**\n`;
                message += `📅 Time: ${this.formatDateTime(`${patrol.date}T${patrol.startTime}`)}\n`;
                message += `📍 Status: ${patrol.status || 'N/A'}\n`;
                if (patrol.notes) message += `📝 Notes: ${patrol.notes}\n`;
                message += `\n---\n`;
            });

            if (patrolData.length > 3) {
                message += `\n📊 Showing 3 of ${patrolData.length} patrols.`;
            }

            console.log(`✅ Formatted guard performance for ${guardName}`);
            return {
                message: message.trim(),
                hasData: true,
                count: patrolData.length
            };
        } catch (error) {
            console.error(`❌ Error formatting guard performance for ${guardName}: ${error.message}\n${error.stack}`);
            throw new Error(`Failed to format guard performance: ${error.message}`);
        }
    }

    formatDateTime(dateString) {
        try {
            if (!dateString) {
                console.warn('⚠️ No date string provided for formatting');
                return 'N/A';
            }
            const date = new Date(dateString);
            const formatted = date.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            console.log(`✅ Formatted date: ${dateString} -> ${formatted}`);
            return formatted;
        } catch (error) {
            console.error(`❌ Error formatting date ${dateString}: ${error.message}\n${error.stack}`);
            return dateString;
        }
    }

    async testConnection() {
        try {
            console.log('🧪 Testing API connection');
            const response = await this.authorizedClient.get('/stats');
            console.log('✅ API Connection successful');
            return { success: true, message: 'API connection successful' };
        } catch (error) {
            console.error(`❌ API Connection failed: ${error.message}\n${error.stack}`);
            return { success: false, message: `API connection failed: ${error.message}` };
        }
    }

    async getGuardsForSite(siteName) {
        try {
            console.log(`👮 Fetching guards for ${siteName}`);
            const site = await this.findSiteByName(siteName);
            if (!site) {
                console.warn(`⚠️ Site "${siteName}" not found`);
                return {
                    message: `Site "${siteName}" not found.`,
                    hasData: false
                };
            }

            const guardsResponse = await this.authorizedClient.get('/users/security-guards', { params: { limit: 1000 } });
            let guards = guardsResponse.data.data.filter(g =>
                g.siteId === site.id ||
                (g.site && g.site.id === site.id) ||
                (Array.isArray(g.sites) && g.sites.some(s => s.id === site.id))
            );

            if (!guards.length) {
                console.log(`🔍 No direct guards found, checking patrols for ${siteName}`);
                const patrolsResponse = await this.unauthorizedClient.get(`/sites/${site.id}/patrols`, { params: { limit: 1000 } });
                const patrols = patrolsResponse.data.data || [];
                const guardIds = [...new Set(patrols.map(p => p.securityGuard && p.securityGuard.id).filter(Boolean))];
                guards = guardsResponse.data.data.filter(g => guardIds.includes(g.id));
            }

            if (!guards.length) {
                console.warn(`⚠️ No guards found for site ${siteName}`);
                return {
                    message: `No guards found for site "${siteName}".`,
                    hasData: false
                };
            }

            let message = `👮 *Guards for ${siteName}*\n\n`;
            guards.forEach((g, i) => {
                message += `${i + 1}. ${g.firstName} ${g.lastName}\n` +
                           `  - ID: ${g.id || 'N/A'}\n` +
                           `  - Status: ${g.isActive ? '✅ Active' : '❌ Inactive'}\n` +
                           `  - Phone: ${g.phone || g.phoneNumber || 'N/A'}\n` +
                           `  - Gender: ${g.gender || 'N/A'}\n` +
                           `  - Date of Birth: ${g.dateOfBirth || 'N/A'}\n` +
                           `  - Type: ${g.type || 'N/A'}\n` +
                           `  - Company: ${g.company?.name || g.company || 'N/A'}\n\n`;
            });
            console.log(`✅ Fetched ${guards.length} guards for ${siteName}`);
            return { message, hasData: true, data: guards };
        } catch (error) {
            console.error(`❌ Error fetching guards for ${siteName}: ${error.message}\n${error.stack}`);
            throw new Error(`Failed to fetch guards: ${error.message}`);
        }
    }
}

async function testCallLogs(api, siteName) {
    try {
        console.log(`🧪 Testing call logs for ${siteName}`);
        const result = await api.getCallLogsForSite(siteName);
        console.log(result.message);
        if (result.hasData) {
            console.log(result.data.slice(0, 3));
        } else {
            console.log("No call logs found.");
        }
    } catch (error) {
        console.error(`❌ Test call logs error: ${error.message}\n${error.stack}`);
    }
}

async function testShifts(api, siteName) {
    try {
        console.log(`🧪 Testing shifts for ${siteName}`);
        const result = await api.getShiftsForSite(siteName);
        console.log(result.message);
        if (result.hasData) {
            console.log(result.data.slice(0, 3));
        } else {
            console.log("No shifts found.");
        }
    } catch (error) {
        console.error(`❌ Test shifts error: ${error.message}\n${error.stack}`);
    }
}

async function testNotifications(api, siteName) {
    try {
        console.log(`🧪 Testing notifications for ${siteName}`);
        const result = await api.getNotificationsForSite(siteName);
        console.log(result.message);
        if (result.hasData) {
            console.log(result.data.slice(0, 3));
        } else {
            console.log("No notifications found.");
        }
    } catch (error) {
        console.error(`❌ Test notifications error: ${error.message}\n${error.stack}`);
    }
}

async function testGuardPerformance(api, guardName) {
    try {
        console.log(`🧪 Testing guard performance for ${guardName}`);
        const result = await api.getGuardPerformance(guardName);
        console.log(result.message);
        if (result.hasData) {
            console.log(result.data.slice(0, 3));
        } else {
            console.log("No performance data found.");
        }
    } catch (error) {
        console.error(`❌ Test guard performance error: ${error.message}\n${error.stack}`);
    }
}