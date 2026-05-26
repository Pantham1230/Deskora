import { Client } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Please set DATABASE_URL environment variable to a Postgres connection string.');
  process.exit(1);
}

async function run() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    console.log('Normalizing roles in users and employees tables...');
    const res1 = await client.query("UPDATE users SET role = 'admin' WHERE role IN ('super_admin','company_admin','branch_manager') RETURNING id, role");
    console.log(`Updated users: ${res1.rowCount}`);
    const res2 = await client.query("UPDATE users SET role = 'staff' WHERE role = 'receptionist' RETURNING id, role");
    console.log(`Updated users (receptionist->staff): ${res2.rowCount}");
    const res3 = await client.query("UPDATE employees SET role = 'admin' WHERE role IN ('super_admin','company_admin','branch_manager') RETURNING id, role");
    console.log(`Updated employees: ${res3.rowCount}`);
    const res4 = await client.query("UPDATE employees SET role = 'staff' WHERE role = 'receptionist' RETURNING id, role");
    console.log(`Updated employees (receptionist->staff): ${res4.rowCount}`);
    console.log('Role normalization complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
