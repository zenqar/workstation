const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('src/app/[locale]/app/(authenticated)', function(filePath) {
  if (filePath.endsWith('page.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    if (content.includes("redirect('/login')") || content.includes("redirect('/signup')") || content.includes("redirect('/app/")) {
      
      // Add imports
      if (!content.includes('getLocalizedPath')) {
        content = content.replace(
          /(import .*? from 'next\/navigation';)/,
          "$1\nimport { getLocale } from 'next-intl/server';\nimport { getLocalizedPath } from '@/lib/utils/locale';"
        );
        changed = true;
      }

      // Add locale const
      if (!content.includes('const locale = await getLocale()')) {
        content = content.replace(
          /(export default async function .*?\(\{?[^}]*\}?\) \{)/,
          "$1\n  const locale = await getLocale();"
        );
        changed = true;
      }

      // Replace redirects
      content = content.replace(/redirect\('\/login'\)/g, "redirect(getLocalizedPath(locale, '/login'))");
      content = content.replace(/redirect\('\/signup'\)/g, "redirect(getLocalizedPath(locale, '/signup'))");
      content = content.replace(/redirect\('\/app\/([^']+)'\)/g, "redirect(getLocalizedPath(locale, '/app/$1'))");
      
      if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed', filePath);
      }
    }
  }
});
