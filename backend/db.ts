// backend/db.ts
import sql from 'mssql';

let poolPromise: Promise<sql.ConnectionPool> | null = null;
let isConnected = false;

// Configuration SQL Server (évaluée de manière lazy pour attendre dotenv)
function getSqlConfig(): sql.config {
  return {
    user: process.env.MSSQL_USER ?? 'intra',
    password: process.env.MSSQL_PASSWORD,
    server: process.env.MSSQL_SERVER ?? '192.168.40.81',
    database: process.env.MSSQL_DATABASE ?? 'Gestion_Intra',
    options: {
      instanceName: process.env.MSSQL_INSTANCE ?? 'SQLEXPRESS',
      encrypt: false,
      trustServerCertificate: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30_000,
    },
  };
}

// Connexion à SQL Server via un pool partagé
export async function connectDB(): Promise<sql.ConnectionPool> {
  const sqlConfig = getSqlConfig();
  
  if (!sqlConfig.password) {
    throw new Error('MSSQL_PASSWORD is required');
  }

  if (!poolPromise) {
    poolPromise = sql.connect(sqlConfig)
      .then(pool => {
        if (!isConnected) {
          console.log(`✅ Base de données connectée: ${sqlConfig.database}`);
          isConnected = true;
        }
        return pool;
      })
      .catch(err => {
        console.error(`❌ Erreur de connexion DB:`, err.message);
        poolPromise = null;
        throw err;
      });
  }

  return poolPromise;
}

// Typage des droits/flags
export type FeatureFlags = {
  canUseApp: boolean;
  canImportFiles: boolean;
};

// Lecture des permissions
export async function getPermissions(user_name: string): Promise<FeatureFlags> {
  const db = await connectDB();
  const result = await db
    .request()
    .input('user_name', sql.NVarChar, user_name)
    .query(
      'SELECT canUseApp, canImportFiles FROM dbo.users WHERE user_name = @user_name'
    );
  const row = result.recordset?.[0];

  if (!row) {
    return { canUseApp: false, canImportFiles: false };
  }

  return {
    canUseApp: Boolean(Number(row.canUseApp ?? 0)),
    canImportFiles: Boolean(Number(row.canImportFiles ?? 0)),
  };
}

// Lecture des statistiques
export async function getTotalTokens(user_name: string): Promise<number> {
  const db = await connectDB();
  const result = await db
    .request()
    .input('user_name', sql.NVarChar, user_name)
    .query('SELECT totalTokens FROM dbo.users WHERE user_name = @user_name');
  const row = result.recordset?.[0];
  return Number(row?.totalTokens ?? 0);
}

export async function getTotalCost(user_name: string): Promise<number> {
  const db = await connectDB();
  const result = await db
    .request()
    .input('user_name', sql.NVarChar, user_name)
    .query('SELECT totalCost FROM dbo.users WHERE user_name = @user_name');
  const row = result.recordset?.[0];
  return Number(row?.totalCost ?? 0);
}

export async function getCostLimit(user_name: string): Promise<number> {
  const db = await connectDB();
  const result = await db
    .request()
    .input('user_name', sql.NVarChar, user_name)
    .query('SELECT maxCost FROM dbo.users WHERE user_name = @user_name');
  const row = result.recordset?.[0];
  return Number(row?.maxCost ?? 2.0);
}

// Mise à jour des statistiques
export async function addTokens(user_name: string, tokens_to_add: number): Promise<void> {
  const db = await connectDB();
  await db
    .request()
    .input('user_name', sql.NVarChar, user_name)
    .input('tokens_to_add', sql.Int, tokens_to_add)
    .query('UPDATE dbo.users SET totalTokens = totalTokens + @tokens_to_add WHERE user_name = @user_name');
}

export async function addCost(user_name: string, cost_to_add: number): Promise<void> {
  const db = await connectDB();
  await db
    .request()
    .input('user_name', sql.NVarChar, user_name)
    .input('cost_to_add', sql.Decimal(18, 4), cost_to_add)
    .query('UPDATE dbo.users SET totalCost = totalCost + @cost_to_add WHERE user_name = @user_name');
}

export async function addRequest(user_name: string): Promise<void> {
  const db = await connectDB();
  await db
    .request()
    .input('user_name', sql.NVarChar, user_name)
    .query('UPDATE dbo.users SET totalRequests = ISNULL(totalRequests, 0) + 1 WHERE user_name = @user_name');
}

export async function addRequestWithFiles(user_name: string): Promise<void> {
  const db = await connectDB();
  await db
    .request()
    .input('user_name', sql.NVarChar, user_name)
    .query('UPDATE dbo.users SET totalRequestsWithFiles = ISNULL(totalRequestsWithFiles, 0) + 1 WHERE user_name = @user_name');
}

// Crée l'utilisateur s'il n'existe pas, avec des valeurs par défaut à 0.
export async function ensureUserExists(user_name: string): Promise<void> {
  const db = await connectDB();
  await db
    .request()
    .input('user_name', sql.NVarChar, user_name)
    .query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE user_name = @user_name)
       BEGIN
         INSERT INTO dbo.users (user_name) VALUES (@user_name);
       END`
    );
}
