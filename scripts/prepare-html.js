
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const publicDir = path.join(projectRoot, 'public');

try {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Helper function to copy files
  const copyFile = (src, dest) => {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`Copied ${src} to ${dest}.`);
    } else {
      console.warn(`${src} not found, skipping copy.`);
    }
  };

  // Copy index.html and update script path
  let htmlContent = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf-8');
  htmlContent = htmlContent.replace(
    '<script type="module" src="/index.tsx"></script>',
    '<script type="module" src="/bundle.js"></script>'
  );
  fs.writeFileSync(path.join(distDir, 'index.html'), htmlContent);
  console.log('index.html prepared for distribution in dist/index.html.');

  // Copy PWA files
  copyFile(path.join(publicDir, 'manifest.json'), path.join(distDir, 'manifest.json'));
  copyFile(path.join(publicDir, 'sw.js'), path.join(distDir, 'sw.js'));

  // Copy assets folder from public to dist
  const assetsDirInPublic = path.join(publicDir, 'assets');
  const assetsDirInDist = path.join(distDir, 'assets');

  if (fs.existsSync(assetsDirInPublic)) {
    // Check if fs.cpSync is available (Node.js >= 16.7.0)
    if (typeof fs.cpSync === 'function') {
        fs.cpSync(assetsDirInPublic, assetsDirInDist, { recursive: true });
        console.log('Copied public/assets to dist/assets using fs.cpSync.');
    } else {
        // Fallback to manual recursive copy for older Node.js versions
        if (!fs.existsSync(assetsDirInDist)) {
            fs.mkdirSync(assetsDirInDist, { recursive: true });
        }
        function copyRecursiveSync(src, dest) {
            const exists = fs.existsSync(src);
            const stats = exists && fs.statSync(src);
            const isDirectory = exists && stats.isDirectory();
            if (isDirectory) {
                if (!fs.existsSync(dest)) {
                    fs.mkdirSync(dest, { recursive: true });
                }
                fs.readdirSync(src).forEach(function(childItemName) {
                    copyRecursiveSync(path.join(src, childItemName),
                                    path.join(dest, childItemName));
                });
            } else {
                fs.copyFileSync(src, dest);
            }
        }
        copyRecursiveSync(assetsDirInPublic, assetsDirInDist);
        console.log('Copied public/assets to dist/assets using manual recursive copy.');
    }
  } else {
    console.warn('public/assets directory not found, skipping copy.');
  }

} catch (error) {
  console.error('Error preparing files for distribution:', error);
  process.exit(1);
}
