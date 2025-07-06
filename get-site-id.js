require('dotenv').config();
const GuardTourAPI = require('./askari-api');

(async () => {
    const api = new GuardTourAPI();
    const site = await api.findSiteByName('Test site');
    if (site) {
        console.log(`ID for "Test site":`, site.id);
    } else {
        console.log('Site not found.');
    }
})();