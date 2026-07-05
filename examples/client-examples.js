/**
 * URL Scraper API Client Examples
 * Various ways to use the URL Scraper API
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// Example 1: Basic URL Scraping
async function basicScraping() {
    console.log('🔍 Basic URL Scraping Example');
    
    try {
        const response = await axios.post(`${API_BASE_URL}/scrape`, {
            url: 'https://httpbin.org/html',
            mode: 'headings-paragraphs'
        });
        
        if (response.data.success) {
            console.log('✅ Success!');
            console.log(`📄 Title: ${response.data.data.title}`);
            console.log(`📊 Found ${response.data.data.content.length} content items`);
            console.log('📝 First item:', response.data.data.content[0]);
        }
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
}

// Example 2: All-text mode
async function allTextMode() {
    console.log('🎯 All-text Mode Example');

    try {
        const response = await axios.post(`${API_BASE_URL}/scrape`, {
            url: 'https://example.com',
            mode: 'all-text'
        });

        if (response.data.success) {
            console.log('✅ Success with all-text extraction!');
            response.data.data.content.forEach((item, index) => {
                console.log(`${index + 1}. [${item.type}] ${item.text.substring(0, 100)}...`);
            });
        }
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }

    console.log('\n' + '='.repeat(50) + '\n');
}

// Example 3: Custom CSS Selector
async function customSelectorScraping() {
    console.log('🎨 Custom CSS Selector Example');
    
    try {
        const response = await axios.post(`${API_BASE_URL}/scrape`, {
            url: 'https://httpbin.org/html',
            mode: 'custom',
            options: {
                selector: 'p'
            }
        });
        
        if (response.data.success) {
            console.log('✅ Success with custom selector!');
            console.log(`📊 Found ${response.data.data.content.length} paragraphs`);
            response.data.data.content.forEach((item, index) => {
                console.log(`${index + 1}. ${item.text.substring(0, 80)}...`);
            });
        }
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
}

// Example 4: Batch Scraping
async function batchScraping() {
    console.log('📦 Batch Scraping Example');
    
    try {
        const response = await axios.post(`${API_BASE_URL}/scrape/batch`, {
            urls: [
                'https://httpbin.org/html',
                'https://example.com'
            ],
            mode: 'all-text'
        });
        
        if (response.data.success) {
            console.log('✅ Batch scraping completed!');
            console.log(`📊 Success: ${response.data.performance.successfulUrls}/${response.data.performance.totalUrls}`);
            
            response.data.data.forEach((result, index) => {
                console.log(`\n${index + 1}. URL: ${result.url}`);
                console.log(`   Success: ${result.success ? '✅' : '❌'}`);
                if (result.success) {
                    console.log(`   Items: ${result.data.content.length}`);
                } else {
                    console.log(`   Error: ${result.error}`);
                }
            });
        }
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
}

// Example 5: Error Handling
async function errorHandlingExample() {
    console.log('⚠️ Error Handling Example');
    
    try {
        // This should fail - invalid URL
        const response = await axios.post(`${API_BASE_URL}/scrape`, {
            url: 'not-a-valid-url',
            mode: 'headings-paragraphs'
        });
    } catch (error) {
        if (error.response) {
            console.log('✅ Caught expected error:');
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Error: ${error.response.data.error}`);
            console.log(`   Field: ${error.response.data.field}`);
        } else {
            console.error('❌ Unexpected error:', error.message);
        }
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
}

// Example 6: Get Available Modes
async function getAvailableModes() {
    console.log('📋 Available Modes Example');
    
    try {
        const response = await axios.get(`${API_BASE_URL}/modes`);
        
        if (response.data.success) {
            console.log('✅ Available scraping modes:');
            response.data.data.modes.forEach((mode, index) => {
                console.log(`${index + 1}. ${mode.name}${mode.default ? ' (default)' : ''}`);
                console.log(`   Description: ${mode.description}`);
                if (mode.requiresOptions) {
                    console.log(`   Required options: ${mode.requiresOptions.join(', ')}`);
                }
                console.log('');
            });
        }
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
}

// Example 7: Performance Monitoring
async function performanceExample() {
    console.log('⚡ Performance Monitoring Example');
    
    const startTime = Date.now();
    
    try {
        const response = await axios.post(`${API_BASE_URL}/scrape`, {
            url: 'https://httpbin.org/html',
            mode: 'articles'
        });
        
        const clientDuration = Date.now() - startTime;
        
        if (response.data.success) {
            console.log('✅ Performance metrics:');
            console.log(`   Server processing time: ${response.data.performance.duration}ms`);
            console.log(`   Total client time: ${clientDuration}ms`);
            console.log(`   Items extracted: ${response.data.performance.itemsExtracted}`);
            console.log(`   Content size: ${response.data.data.metadata.contentLength} bytes`);
        }
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
}

// Helper function to check API health
async function checkHealth() {
    console.log('❤️ Health Check Example');
    
    try {
        const response = await axios.get('http://localhost:3000/health/detailed');
        
        if (response.data.success) {
            console.log('✅ API is healthy!');
            console.log(`   Uptime: ${Math.round(response.data.system.uptime)}s`);
            console.log(`   Memory used: ${response.data.memory.heapUsed}MB`);
            console.log(`   Node version: ${response.data.system.nodeVersion}`);
        }
    } catch (error) {
        console.error('❌ API is not accessible:', error.message);
        console.log('Make sure the API is running: npm start');
        return false;
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    return true;
}

// Main execution
async function runAllExamples() {
    console.log('🚀 URL Scraper API Examples\n');
    
    // Check if API is running
    const isHealthy = await checkHealth();
    if (!isHealthy) {
        process.exit(1);
    }
    
    // Run all examples
    await getAvailableModes();
    await basicScraping();
    await allTextMode();
    await customSelectorScraping();
    await batchScraping();
    await errorHandlingExample();
    await performanceExample();
    
    console.log('🎉 All examples completed!');
}

// Export for use in other files
module.exports = {
    basicScraping,
    allTextMode,
    customSelectorScraping,
    batchScraping,
    errorHandlingExample,
    getAvailableModes,
    performanceExample,
    checkHealth
};

// Run examples if this file is executed directly
if (require.main === module) {
    runAllExamples().catch(console.error);
}
