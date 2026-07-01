const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const icons = {
  home: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><path d="M5 13.5L16 5l11 8.5V26a1 1 0 0 1-1 1h-6v-8h-8v8H6a1 1 0 0 1-1-1V13.5z" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  stats: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><path d="M5 26h22" stroke="#000" stroke-width="2.5" stroke-linecap="round"/><rect x="8" y="16" width="4" height="10" rx="1" stroke="#000" stroke-width="2.5"/><rect x="14" y="10" width="4" height="16" rx="1" stroke="#000" stroke-width="2.5"/><rect x="20" y="14" width="4" height="12" rx="1" stroke="#000" stroke-width="2.5"/></svg>`,
  tools: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="13" r="6" stroke="#000" stroke-width="2.5"/><path d="M16 19v8M11 27h10" stroke="#000" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  settings: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="3" stroke="#000" stroke-width="2.5"/><path d="M16 4v3M16 25v3M4 16h3M25 16h3M7.5 7.5l2.1 2.1M22.4 22.4l2.1 2.1M7.5 24.5l2.1-2.1M22.4 9.6l2.1-2.1" stroke="#000" stroke-width="2.5" stroke-linecap="round"/></svg>`,
};

const dir = path.resolve(__dirname, '..', 'assets/images/tabIcons');

const sizes = [
  { suffix: '', size: 32 },
  { suffix: '@2x', size: 64 },
  { suffix: '@3x', size: 96 },
];

(async () => {
  for (const [name, svg] of Object.entries(icons)) {
    for (const { suffix, size } of sizes) {
      const filename = path.join(dir, `${name}${suffix}.png`);
      await sharp(Buffer.from(svg))
        .resize(size, size)
        .png()
        .toFile(filename);
      console.log(`Created ${filename}`);
    }
  }
})();
