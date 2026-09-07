// Preserve physical storage while deployments switch to the plugin-free application.
// The generated snapshot records the target schema; the contract release removes the retired tables.
export async function up(): Promise<void> {}

// No physical schema changed in this compatibility stage.
export async function down(): Promise<void> {}
