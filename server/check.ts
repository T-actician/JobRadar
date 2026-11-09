// Live check: npm run collect:check [sourceId]. Runs adapters WITHOUT touching the database.
import { ADAPTERS } from './sources';
import { normalizeJob } from './normalize';
import { log } from './log';

const only = process.argv[2];
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : 'n/a');

async function main(): Promise<void> {
for (const a of ADAPTERS) {
  if (only && a.id !== only) continue;
  console.log(`\n=== ${a.name} (${a.kind}) ===`);
  try {
    const out = await a.run({ known: new Set(), maxNew: Number(process.env.CHECK_MAX ?? 6), log });
    const jobs = out.jobs.map((r) => normalizeJob(r));
    console.log(`links/items seen: ${out.seen.length}, parsed: ${jobs.length}`);
    console.log(`coverage  employer ${pct(jobs.filter((j) => j.employer !== 'Not specified').length, jobs.length)} | deadline ${pct(jobs.filter((j) => j.deadline).length, jobs.length)} | county ${pct(jobs.filter((j) => j.county !== 'Not specified').length, jobs.length)} | type ${pct(jobs.filter((j) => j.type !== 'Not specified').length, jobs.length)} | description>200 ${pct(jobs.filter((j) => j.description.length > 200).length, jobs.length)}`);
    for (const j of jobs.slice(0, 3)) console.log(`  - ${j.title} | ${j.employer} | ${j.county} | ${j.type} | ${j.level} | deadline ${j.deadline ?? '-'}\n    ${j.applyUrl}`);
  } catch (e) { console.log(`FAILED: ${(e as Error).message}`); }
}
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
