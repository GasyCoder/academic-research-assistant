import { readFile } from 'node:fs/promises';
import { readDocument, proposeReplacement } from '@gasycoder/document-formats';

const source = await readFile(new URL('./manuscript.md', import.meta.url), 'utf8');
const document = await readDocument(source, { format: 'markdown', scope: { kind: 'complete' } });
const segment = document.segments.find(s => s.text.includes('reslts'));
if (!segment) throw new Error('Synthetic example passage was not extracted');
const proposal = proposeReplacement(document, { revision: document.revision, segmentId: segment.id,
  offset: segment.text.indexOf('reslts'), length: 6 }, 'results');
if (source.slice(proposal.location.start, proposal.location.end) !== 'reslts' || proposal.applied)
  throw new Error('Example mapping invariant failed');
console.log(JSON.stringify({ format: document.format, sections: document.sections.map(s => s.title),
  eligibleSegments: document.segments.length, typo: 'reslts', proposal }, null, 2));
