// Variables de entorno para tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-vitest-2026';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-vitest-2026';
// Via SSH tunnel (ssh -f -N -L 15432:localhost:5432 claude@187.124.128.126)
process.env.DATABASE_URL = 'postgresql://crm_user:CrmDB2026!Secure@127.0.0.1:15432/crm_test_db';
process.env.PORT = '3099';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.LOG_LEVEL = 'silent';
