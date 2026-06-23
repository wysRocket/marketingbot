const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH || '/app/pw-browsers';
const chromiumPath = path.join(browsersPath, 'chromium-1208', 'chrome-linux64', 'chrome');

if (fs.existsSync(chromiumPath)) {
  console.log('Chrome already present at', chromiumPath);
  process.exit(0);
}

console.log('Downloading Chrome for Testing...');
fs.mkdirSync(browsersPath, { recursive: true });

// Use playwright-core's install mechanism
try {
  execSync(`npx patchright-core install chromium`, {
    cwd: path.join(__dirname, 'node_modules', 'patchright-core'),
    stdio: 'inherit',
    timeout: 180000,
  });
} catch (e) {
  console.log('patchright-core install failed, trying alternative...');
  // Alternative: use node to trigger the download
  try {
    execSync(`node -e "require('patchright').chromium.launch().then(b => b.close())"`, {
      stdio: 'inherit',
      timeout: 180000,
    });
  } catch (e2) {
    console.error('Both install methods failed');
    process.exit(1);
  }
}

if (fs.existsSync(chromiumPath)) {
  console.log('Chrome downloaded successfully');
} else {
  console.error('Chrome not found at expected path:', chromiumPath);
  process.exit(1);
}
