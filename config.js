// Root configuration shared for backend
// Moved PORT and MAX_OUTPUT_TOKENS here so they live in code with sane defaults.
// You can still override via environment variables if needed.

export const PORT = Number(process.env.PORT ?? 3000);
export const MAX_OUTPUT_TOKENS = Number(process.env.MAX_OUTPUT_TOKENS ?? 4096);
