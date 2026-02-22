import { getDataSource } from '../data-source';

export async function runMigrations(): Promise<{ success: boolean; message: string }> {
  try {
    const ds = await getDataSource();
    await ds.runMigrations();
    await ds.destroy(); 
    return { success: true, message: 'Migrations completed successfully' };
  } catch (err) {
    console.error('Migration error:', err);
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message };
  }
}

export async function handler(): Promise<{ statusCode: number; body: string }> {
  const result = await runMigrations();
  return {
    statusCode: result.success ? 200 : 500,
    body: JSON.stringify(result),
  };
}
