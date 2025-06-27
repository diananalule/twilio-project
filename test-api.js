// test-api.js - Quick API connection test
require('dotenv').config();
const axios = require('axios');

const baseURL = 'https://guardtour.legitsystemsug.com';
const authToken = process.env.ASKARI_AUTH_TOKEN;

console.log('🔍 Testing GuardTour API connection...');
console.log('Base URL:', baseURL);
console.log('Auth Token:', authToken ? 'Provided ✅' : 'Missing ❌');

// Create axios instance
const client = axios.create({
    baseURL: baseURL,
    timeout: 10000,
    headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
    }
});

// Test the actual endpoints from your API documentation
const endpoints = [
    '/stats',
    '/sites',
    '/users/security-guards',
    '/users/company-admins',
    '/users/site-admins',
    '/companies',
    '/tags'
];

async function testEndpoint(endpoint) {
    try {
        console.log(`\n🔄 Testing: ${endpoint}`);
        const response = await client.get(endpoint);
        console.log(`✅ Success: ${endpoint}`);
        console.log(`Status: ${response.status}`);
        console.log(`Data type: ${typeof response.data}`);
        console.log(`Data sample:`, JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
        return { endpoint, success: true, data: response.data };
    } catch (error) {
        console.log(`❌ Failed: ${endpoint}`);
        console.log(`Error: ${error.response?.status} - ${error.response?.statusText || error.message}`);
        return { endpoint, success: false, error: error.message };
    }
}

async function runTests() {
    console.log('\n🚀 Starting API endpoint discovery...\n');
    
    const results = [];
    
    for (const endpoint of endpoints) {
        const result = await testEndpoint(endpoint);
        results.push(result);
        
        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n📊 Summary of Results:');
    console.log('='.repeat(50));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful endpoints: ${successful.length}`);
    successful.forEach(r => console.log(`   - ${r.endpoint}`));
    
    console.log(`\n❌ Failed endpoints: ${failed.length}`);
    failed.forEach(r => console.log(`   - ${r.endpoint}`));
    
    if (successful.length > 0) {
        console.log('\n🎉 Great! Your API is accessible. Now we can configure the WhatsApp bot.');
        console.log('\nNext steps:');
        console.log('1. Note which endpoints work');
        console.log('2. Look at the data structure returned');
        console.log('3. Update the WhatsApp bot to use these endpoints');
    } else {
        console.log('\n🚨 No endpoints were accessible. Please check:');
        console.log('1. Your access token is correct');
        console.log('2. The token has the right permissions');
        console.log('3. The API base URL is correct');
    }
}

// Run the test
runTests().catch(error => {
    console.error('💥 Test failed:', error.message);
});