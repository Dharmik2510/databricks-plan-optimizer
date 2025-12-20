import axios from 'axios';

async function testPricingApi() {
    try {
        console.log('Testing runs-on.com API...');
        const region = 'us-east-1';
        const url = `https://go.runs-on.com/api/finder`;

        console.log(`Fetching from: ${url} for region: ${region}`);

        const response = await axios.get(url, {
            params: {
                region: region,
                os: 'linux',
            }
        });

        const results = response.data.results;

        if (!results || results.length === 0) {
            console.error('No results returned from API');
            return;
        }

        console.log(`Success! Received ${results.length} instances.`);
        console.log('Sample instance:', results[0]);

        // precise check of fields we map
        const item = results[0];
        console.log('Mapping check:');
        console.log(`- instanceType (id/name): ${item.instanceType}`);
        console.log(`- instanceFamily: ${item.instanceFamily}`);
        console.log(`- vcpus: ${item.vcpus}`);
        console.log(`- memoryGiB: ${item.memoryGiB}`);
        console.log(`- avgOnDemandPrice: ${item.avgOnDemandPrice}`);

    } catch (error) {
        console.error('API Test Failed:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

testPricingApi();
