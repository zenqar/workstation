async function main() {
const fs = await import('node:fs');
const path = await import('node:path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) walkDir(dirPath, callback);
    else callback(path.join(dir, f));
  });
}

walkDir('src/app', function(filePath) {
  if (filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    if (content.includes("useParams")) {
      // Add useLocale import if missing
      if (!content.includes('useLocale')) {
        content = content.replace(
          /import \{ useTranslations \} from 'next-intl';/,
          "import { useTranslations, useLocale } from 'next-intl';"
        );
        changed = true;
      }

      // Replace params = useParams()
      if (content.includes('const params = useParams();') && content.includes('const locale = params.locale')) {
        content = content.replace(/const params = useParams\(\);[\s\n]*const locale = params\.locale as string;/, "const locale = useLocale();");
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed', filePath);
      }
    }
  }
});

}

void main();
