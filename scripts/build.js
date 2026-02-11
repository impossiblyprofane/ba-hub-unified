#!/usr/bin/env node

/**
 * Build script for production
 */

import { execSync } from 'child_process';

console.log('🔨 Building all packages...\n');

const steps = [
  { name: 'Shared types', cmd: 'npm run build:shared' },
  { name: 'Backend', cmd: 'npm run build:backend' },
  { name: 'Frontend', cmd: 'npm run build:frontend' },
];

try {
  for (const step of steps) {
    console.log(`\n📦 Building ${step.name}...`);
    execSync(step.cmd, { stdio: 'inherit' });
  }
  
  console.log('\n✅ Build completed successfully!');
} catch (error) {
  console.error('\n❌ Build failed');
  process.exit(1);
}
