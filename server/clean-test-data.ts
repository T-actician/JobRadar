import { closeDb, deleteBySource, openDb } from './db';

// Older test runs left one fake job (source "Test") in the real database. This removes it.
async function main(): Promise<void> {
  await openDb();
  console.log(`Removed ${deleteBySource('Test')} leftover test job(s).`);
  closeDb();
}
void main();
