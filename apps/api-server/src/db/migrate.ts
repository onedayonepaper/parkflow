import { initDb, closeDb } from './index.js';

async function migrate() {
  console.log('🔄 Running migrations...');

  initDb();

  console.log('✅ Migrations completed!');

  closeDb();
}

migrate().catch(console.error);
