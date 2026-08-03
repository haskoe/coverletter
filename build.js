import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

// 1. Dine sprogpakker med ledetekster
const localeBundle = {
  da: {
    'Work Experience': 'Erhvervserfaring',
    'Experience': 'Erhvervserfaring',
    'Education': 'Uddannelse',
    'Interests': 'Interesser',
    'Skills': 'Kompetencer',
    'Projects': 'Projekter',
    'Publications': 'Publikationer',
    'Awards': 'Udmærkelser',
    'About': 'Om mig',
    'Motivation': 'Motivation',
    'Status': 'Status',
    'Present': 'Nu'
  },
  en: {
    'Work Experience': 'Work Experience',
    'Experience': 'Experience',
    'Education': 'Education',
    'Interests': 'Interests'
  }
};

// 2. Argumenter: `node build.js [sprog] [tema]` (f.eks. `node build.js da even`)
const lang = process.argv[2] || 'da';
const themeName = process.argv[3] || 'even';
const selectedLocale = localeBundle[lang] || localeBundle.da;

// 3. Funktion til at erstatte ledetekster direkte i HTML-teksten
function translateHtml(html, dictionary) {
  let translatedHtml = html;
  
  for (const [english, translation] of Object.entries(dictionary)) {
    // A. Erstat overskrifter i tags (f.eks. <h2>Work Experience</h2> eller >WORK EXPERIENCE<)
    const tagRegex = new RegExp(`(>\\s*)(${english})(\\s*<)`, 'gi');
    translatedHtml = translatedHtml.replace(tagRegex, `$1${translation}$3`);

    // B. Erstat rene strenge i HTML'en (med case-insensitive regex)
    const exactRegex = new RegExp(`\\b${english}\\b`, 'gi');
    translatedHtml = translatedHtml.replace(exactRegex, translation);
  }

  return translatedHtml;
}

// 4. Dynamisk load af tema
async function loadTheme(name) {
  try {
    const themeModule = await import(`jsonresume-theme-${name}`);
    return themeModule.default || themeModule;
  } catch (npmErr) {
    try {
      const themeModule = await import(`./themes/${name}/index.js`);
      return themeModule.default || themeModule;
    } catch (localErr) {
      throw new Error(`Kunne ikke finde temaet '${name}'. Tjek npm-installation eller mappen ./themes/${name}`);
    }
  }
}

async function main() {
  console.log(`📦 Henter tema '${themeName}'...`);
  const theme = await loadTheme(themeName);

  // Læs resume.json
  const rawData = fs.readFileSync('./resume.json', 'utf-8');
  const resumeJson = JSON.parse(rawData);

  const renderFn = theme.render || theme;
  if (typeof renderFn !== 'function') {
    throw new Error(`Temaet '${themeName}' har ingen gyldig render-funktion.`);
  }

  // A. Generer den oprindelige HTML fra temaet
  let rawHtml = renderFn(resumeJson);

  // B. OVERSÆT LEDETEKSTER I HTML-STRONGEN
  console.log(`🔤 Oversætter ledetekster til [${lang.toUpperCase()}]...`);
  const translatedHtml = translateHtml(rawHtml, selectedLocale);

  // C. Opret /dist mappe og gem den oversatte HTML
  const distDir = path.resolve('./dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
  }

  const htmlPath = path.join(distDir, `index_${lang}_${themeName}.html`);
  const pdfPath = path.join(distDir, `Julian_CV_${lang}_${themeName}.pdf`);

  fs.writeFileSync(htmlPath, translatedHtml);
  console.log(`📄 Oversat HTML gemt: ${htmlPath}`);

  // --- PDF GENERERING VIA PUPPETEER ---
  console.log(`🖨️  Genererer PDF med Puppeteer...`);

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files']
  });

  const page = await browser.newPage();

  // Åbn den oversatte HTML-fil direkte via file://
  const fileUrl = `file://${htmlPath}`;
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });

  // Tving 'screen' så farver og tema-styling bevares 100%
  await page.emulateMediaType('screen');

  // Generer PDF
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '0mm',
      bottom: '0mm',
      left: '0mm',
      right: '0mm'
    }
  });

  await browser.close();
  console.log(`🚀 PDF med danske ledetekster oprettet -> ${pdfPath}`);
}

main().catch(err => {
  console.error(`❌ Fejl:`, err.message);
  process.exit(1);
});