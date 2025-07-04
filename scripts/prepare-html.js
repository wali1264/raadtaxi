
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const publicDir = path.join(projectRoot, 'public');

try {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Copy index.html and update script path
  let htmlContent = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf-8');
  htmlContent = htmlContent.replace(
    '<script type="module" src="/index.tsx"></script>',
    '<script type="module" src="/bundle.js"></script>'
  );
  fs.writeFileSync(path.join(distDir, 'index.html'), htmlContent);
  console.log('index.html prepared for distribution in dist/index.html.');

  // List of files to copy from 'public' to 'dist'
  const publicFilesToCopy = ['manifest.json', 'sw.js'];
  
  publicFilesToCopy.forEach(fileName => {
      const srcPath = path.join(publicDir, fileName);
      const destPath = path.join(distDir, fileName);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied public/${fileName} to dist/${fileName}.`);
      } else {
        console.warn(`File not found, skipping: ${srcPath}`);
      }
  });

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
