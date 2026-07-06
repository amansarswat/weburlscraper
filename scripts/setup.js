#!/usr/bin/env node

/**
 * Setup script for URL Scraper API
 * Automates initial setup and configuration
 */

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🚀 URL Scraper API Setup\n');

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 20) {
    console.error('❌ Node.js 20 or higher is required');
    console.error(`   Current version: ${nodeVersion}`);
    console.error('   Please upgrade Node.js and try again');
    process.exit(1);
}

console.log(`✅ Node.js ${nodeVersion} detected`);

// Check if package.json exists
if (!fs.existsSync('package.json')) {
    console.error('❌ package.json not found');
    console.error('   Make sure you are in the url-scraper-package directory');
    process.exit(1);
}

// Install dependencies
console.log('\n📦 Installing dependencies...');
try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed successfully');
} catch (error) {
    console.error('❌ Failed to install dependencies');
    console.error(error.message);
    process.exit(1);
}

// Create .env file if it doesn't exist
const envPath = '.env';
const envExamplePath = 'config.env.example';

if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    console.log('\n⚙️  Creating environment configuration...');
    try {
        const envExample = fs.readFileSync(envExamplePath, 'utf8');
        fs.writeFileSync(envPath, envExample);
        console.log('✅ Created .env file from config.env.example');
        console.log('   You can customize the settings in .env file');
    } catch (error) {
        console.warn('⚠️  Could not create .env file:', error.message);
    }
}

// Create logs directory
const logsDir = 'logs';
if (!fs.existsSync(logsDir)) {
    console.log('\n📁 Creating logs directory...');
    try {
        fs.mkdirSync(logsDir);
        console.log('✅ Created logs directory');
    } catch (error) {
        console.warn('⚠️  Could not create logs directory:', error.message);
    }
}

// Test the setup
console.log('\n🧪 Testing setup...');
try {
    // Try to require the main app
    require('./app');
    console.log('✅ Application loads successfully');
} catch (error) {
    console.error('❌ Application failed to load:', error.message);
    process.exit(1);
}

// Success message
console.log('\n🎉 Setup completed successfully!');
console.log('\n📋 Next steps:');
console.log('   1. Review settings in .env file');
console.log('   2. Start the server: npm start');
console.log('   3. Test the API: curl http://localhost:3000/health');
console.log('   4. Check examples in the examples/ folder');
console.log('\n📚 Documentation:');
console.log('   • Quick Start: QUICK_START.md');
console.log('   • Full Docs: README.md');
console.log('   • API Docs: http://localhost:3000/api/docs (after starting)');
console.log('\n🚀 Happy scraping!');
