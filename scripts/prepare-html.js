
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

try {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  let htmlContent = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf-8');
  
  htmlContent = htmlContent.replace(
    '<script type="module" src="/src/index.tsx"></script>',
    '<script type="module" src="/bundle.js"></script>'
  );

  // If there are other assets to copy from a public folder, do it here.
  // For now, only index.html processing.

  fs.writeFileSync(path.join(distDir, 'index.html'), htmlContent);
  console.log('index.html prepared for distribution in dist/index.html.');

} catch (error) {
  console.error('Error preparing HTML for distribution:', error);
  process.exit(1);
}
