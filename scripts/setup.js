#!/usr/bin/env node

/**
 * Development setup script
 * Installs dependencies for all workspaces
 */

import { execSync } from 'child_process';

console.log('📦 Installing dependencies...\n');

try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('\n✅ Dependencies installed successfully!');
  console.log('\n🚀 Start development:');
  console.log('   npm run dev');
  console.log('\n📝 Or run individually:');
  console.log('   cd backend && npm run dev');
  console.log('   cd frontend && npm run dev');
} catch (error) {
  console.error('❌ Failed to install dependencies');
  process.exit(1);
}
