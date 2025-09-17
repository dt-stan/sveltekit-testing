import fs from 'fs';
import path from 'path';

const indexPath = path.resolve('build/compute/default/index.js');

const dynatraceCode = `
const DT_ENV = env("DT_ENV");
const DT_TOKEN = env("DT_TOKEN");

try {
  const oneAgent = await import('@dynatrace/oneagent');
  oneAgent.default({
    environmentid: DT_ENV,
    apitoken: DT_TOKEN
  });
} catch (err) {
  console.log('Failed to load OneAgent: ', err);
}
`;

fs.readFile(indexPath, 'utf8', (err, data) => {
  if (err) {
    console.error('❌ Failed to read index.js:', err);
    process.exit(1);
  }

  const lines = data.split('\n');
  let insertIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import')) {
      insertIndex = i + 1;
    }
  }

  lines.splice(insertIndex, 0, dynatraceCode);
  const patchedContent = lines.join('\n');

  fs.writeFile(indexPath, patchedContent, 'utf8', (err) => {
    if (err) {
      console.error('❌ Failed to write patched index.js:', err);
      process.exit(1);
    }
    console.log('✅ Dynatrace OneAgent code inserted into index.js');
  });
});
