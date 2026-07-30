import fs from 'fs';
let content = fs.readFileSync('src/utils/export.ts', 'utf-8');

// Fix bold on paragraph
content = content.replace(
  'children.unshift(new Paragraph({ text: "⚠️ WARNING: This analysis contains claims the transcript does not support.", bold: true }));',
  'children.unshift(new Paragraph({ children: [new TextRun({ text: "⚠️ WARNING: This analysis contains claims the transcript does not support.", bold: true })] }));'
);

// Fix italics on paragraph
content = content.replace(
  'children.push(new Paragraph({ text: \`"\${claim.quote}"\`, italics: true }));',
  'children.push(new Paragraph({ children: [new TextRun({ text: \`"\${claim.quote}"\`, italics: true })] }));'
);

fs.writeFileSync('src/utils/export.ts', content);
