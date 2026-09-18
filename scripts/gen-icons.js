const sharp = require('sharp');
const path = require('path');
const out = (f) => path.join(__dirname, '..', 'assets', f);
const bg = '#0B0D10', fg = '#FF5A36';
// Barbell glyph on a 1024 canvas; `s` scales it (adaptive icons need a smaller safe zone).
const glyph = (s = 1) => `<g transform="translate(512 512) scale(${s}) translate(-512 -512)" fill="${fg}">
  <rect x="300" y="482" width="424" height="60" rx="14"/>
  <rect x="236" y="372" width="64" height="280" rx="20"/><rect x="724" y="372" width="64" height="280" rx="20"/>
  <rect x="168" y="424" width="56" height="176" rx="16"/><rect x="800" y="424" width="56" height="176" rx="16"/>
</g>`;
const svg = (body, bgFill = bg) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">${bgFill ? `<rect width="1024" height="1024" fill="${bgFill}"/>` : ''}${body}</svg>`);
(async () => {
  await sharp(svg(glyph(1))).png().toFile(out('icon.png'));
  await sharp(svg(glyph(0.72), null)).png().toFile(out('android-icon-foreground.png'));
  await sharp(svg('', bg)).png().toFile(out('android-icon-background.png'));
  await sharp(svg(glyph(0.72).replace(fg, '#FFFFFF').replace(new RegExp(fg, 'g'), '#FFFFFF'), null)).png().toFile(out('android-icon-monochrome.png'));
  await sharp(svg(glyph(0.6), null)).png().toFile(out('splash-icon.png'));
  await sharp(svg(glyph(1))).resize(48, 48).png().toFile(out('favicon.png'));
  console.log('icons written');
})();
