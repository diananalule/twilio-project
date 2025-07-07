import "dotenv/config";
import GuardTourAPI from './askari-api.js';

const CONFIG = {
    username: process.env.ASKARI_API_USERNAME,
    password: process.env.ASKARI_API_PASSWORD,
    testSiteName: 'Test site',
    testGuardName: 'Rebecca',
    testDate: '2024-07-01' // Test date for filtering
};

class APITester {
    constructor() {
        this.api = new GuardTourAPI(CONFIG.username, CONFIG.password);
        this.testResults = [];
    }

    // Helper method to log test results
    logTest(testName, success, message, data = null) {
        const result = {
            test: testName,
            success,
            message,
            data,
            timestamp: new Date().toISOString()
        };
        
        this.testResults.push(result);
        
        const status = success ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} - ${testName}: ${message}`);
        
        if (data && success) {
            console.log('   Data preview:', JSON.stringify(data, null, 2).substring(0, 200) + '...');
        }
        console.log('');
    }

    // Test API connection
    async testConnection() {
        try {
            const result = await this.api.testConnection();
            this.logTest('API Connection', result.success, result.message);
            return result.success;
        } catch (error) {
            this.logTest('API Connection', false, error.message);
            return false;
        }
    }

    // Test authentication
    async testAuthentication() {
        try {
            const token = await this.api.authenticate();
            const success = token && token.length > 0;
            this.logTest('Authentication', success, success ? 'Token received' : 'No token received', { tokenLength: token?.length });
            return success;
        } catch (error) {
            this.logTest('Authentication', false, error.message);
            return false;
        }
    }

    // Test getting all sites
    async testGetAllSites() {
        try {
            const sites = await this.api.getAllSites();
            const success = Array.isArray(sites) && sites.length > 0;
            this.logTest('Get All Sites', success, success ? `Found ${sites.length} sites` : 'No sites found', { count: sites?.length });
            return success ? sites : null;
        } catch (error) {
            this.logTest('Get All Sites', false, error.message);
            return null;
        }
    }

    // Test getting site information
    async testGetSiteInfo(siteName) {
        try {
            const result = await this.api.getSiteInfo(siteName);
            const success = result.hasData;
            this.logTest('Get Site Info', success, result.message, result.data);
            return success ? result : null;
        } catch (error) {
            this.logTest('Get Site Info', false, error.message);
            return null;
        }
    }

    // Test getting patrol reports without date filter
    async testGetPatrolReports(siteName) {
        try {
            const result = await this.api.getPatrolReports(siteName);
            const success = result.hasData;
            this.logTest('Get Patrol Reports', success, result.message, { count: result.count });
            return success ? result : null;
        } catch (error) {
            this.logTest('Get Patrol Reports', false, error.message);
            return null;
        }
    }

    // Test getting patrol reports with date filter
    async testGetPatrolReportsWithDate(siteName, date) {
        try {
            const result = await this.api.getPatrolReports(siteName, date);
            const success = result.hasData;
            this.logTest('Get Patrol Reports (with date)', success, `${result.message} (filtered by ${date})`, { count: result.count });
            return success ? result : null;
        } catch (error) {
            this.logTest('Get Patrol Reports (with date)', false, error.message);
            return null;
        }
    }

    // Test getting guard information
    async testGetGuardInfo(guardName) {
        try {
            const result = await this.api.getGuardInfo(guardName);
            const success = result.hasData;
            this.logTest('Get Guard Info', success, result.message, result.data);
            return success ? result : null;
        } catch (error) {
            this.logTest('Get Guard Info', false, error.message);
            return null;
        }
    }

    // Test getting site performance
    async testGetSitePerformance(siteName, timeframe = 'today') {
        try {
            const result = await this.api.getSitePerformance(siteName, timeframe);
            const success = result.hasData;
            this.logTest(`Get Site Performance (${timeframe})`, success, result.message, result.data);
            return success ? result : null;
        } catch (error) {
            this.logTest(`Get Site Performance (${timeframe})`, false, error.message);
            return null;
        }
    }

    // Test getting system stats
    async testGetSystemStats() {
        try {
            const result = await this.api.getSystemStats();
            const success = result.hasData;
            this.logTest('Get System Stats', success, result.message, result.data);
            return success ? result : null;
        } catch (error) {
            this.logTest('Get System Stats', false, error.message);
            return null;
        }
    }

    // Test finding site by name
    async testFindSiteByName(siteName) {
        try {
            const site = await this.api.findSiteByName(siteName);
            const success = site !== null;
            this.logTest('Find Site By Name', success, success ? `Found site: ${site.name}` : 'Site not found', site);
            return success ? site : null;
        } catch (error) {
            this.logTest('Find Site By Name', false, error.message);
            return null;
        }
    }

    // Test getting guard by name
    async testGetGuardByName(guardName) {
        try {
            const guard = await this.api.getGuardByName(guardName);
            const success = guard !== null && guard !== undefined;
            this.logTest('Get Guard By Name', success, success ? `Found guard: ${guard.fullName}` : 'Guard not found', guard);
            return success ? guard : null;
        } catch (error) {
            this.logTest('Get Guard By Name', false, error.message);
            return null;
        }
    }

    // Run all tests
    async runAllTests() {
        console.log('🚀 Starting GuardTour API Tests...\n');
        console.log('='.repeat(50));

        // Test 1: Connection
        const connectionOk = await this.testConnection();
        if (!connectionOk) {
            console.log('❌ Connection failed. Stopping tests.');
            return this.printSummary();
        }

        // Test 2: Authentication
        const authOk = await this.testAuthentication();
        if (!authOk) {
            console.log('❌ Authentication failed. Stopping tests.');
            return this.printSummary();
        }

        // Test 3: Get all sites (to get a real site name for testing)
        const sites = await this.testGetAllSites();
        const testSite = sites && sites.length > 0 ? sites[0].name : CONFIG.testSiteName;

        // Test 4: Find site by name
        const foundSite = await this.testFindSiteByName(CONFIG.testSiteName);

        // Test 5: Get site info
        await this.testGetSiteInfo(CONFIG.testSiteName);

        // Test 6: Get patrol reports (no date filter)
        await this.testGetPatrolReports(CONFIG.testSiteName);

        // Test 7: Get patrol reports (with date filter)
        await this.testGetPatrolReportsWithDate(CONFIG.testSiteName, CONFIG.testDate);

        // Test 8: Get guard by name
        await this.testGetGuardByName(CONFIG.testGuardName);

        // Test 9: Get guard info
        await this.testGetGuardInfo(CONFIG.testGuardName);

        // Test 10: Get site performance (today)
        await this.testGetSitePerformance(testSite, 'today');

        // Test 11: Get site performance (month)
        await this.testGetSitePerformance(testSite, 'month');

        // Test 12: Get system stats
        await this.testGetSystemStats();

        // Print summary
        this.printSummary();
    }

    // Print test summary
    printSummary() {
        console.log('\n' + '='.repeat(50));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(50));

        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.success).length;
        const failedTests = totalTests - passedTests;

        console.log(`Total Tests: ${totalTests}`);
        console.log(`✅ Passed: ${passedTests}`);
        console.log(`❌ Failed: ${failedTests}`);
        console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

        if (failedTests > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults
                .filter(r => !r.success)
                .forEach(r => console.log(`   - ${r.test}: ${r.message}`));
        }

        console.log('\n🔍 Detailed Results:');
        this.testResults.forEach(r => {
            const status = r.success ? '✅' : '❌';
            console.log(`   ${status} ${r.test}: ${r.message}`);
        });

        return this.testResults;
    }

    // Test specific functionality
    async testSpecificFeature(feature, ...args) {
        switch (feature.toLowerCase()) {
            case 'connection':
                return await this.testConnection();
            case 'auth':
                return await this.testAuthentication();
            case 'sites':
                return await this.testGetAllSites();
            case 'site':
                return await this.testGetSiteInfo(args[0] || CONFIG.testSiteName);
            case 'patrols':
                return await this.testGetPatrolReports(args[0] || CONFIG.testSiteName);
            case 'patrols-date':
                return await this.testGetPatrolReportsWithDate(args[0] || CONFIG.testSiteName, args[1] || CONFIG.testDate);
            case 'guard':
                return await this.testGetGuardInfo(args[0] || CONFIG.testGuardName);
            case 'performance':
                return await this.testGetSitePerformance(args[0] || CONFIG.testSiteName, args[1] || 'today');
            case 'stats':
                return await this.testGetSystemStats();
            default:
                console.log('❌ Unknown feature. Available: connection, auth, sites, site, patrols, patrols-date, guard, performance, stats');
                return false;
        }
    }
}

// Main execution
async function main() {
    const tester = new APITester();

    // Check if specific test is requested
    const args = process.argv.slice(2);
    if (args.length > 0) {
        const feature = args[0];
        const additionalArgs = args.slice(1);
        await tester.testSpecificFeature(feature, ...additionalArgs);
    } else {
        await tester.runAllTests();
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Export for use in other modules
export default APITester;

// Run tests if this file is executed directly
main().catch(console.error);
