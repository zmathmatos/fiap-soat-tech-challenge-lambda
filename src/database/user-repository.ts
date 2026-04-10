import { Client } from "pg";
import { getSSMParameter } from "../config/ssm";

export interface UserRecord {
  id: string;
  name: string;
  document: string;
  email: string;
  role: string;
}

let cachedClient: Client | null = null;

async function getClient(): Promise<Client> {
  if (cachedClient) {
    return cachedClient;
  }

  const dbHost = process.env.DB_HOST;
  const dbPort = parseInt(process.env.DB_PORT || "5432", 10);
  const dbName = process.env.DB_NAME;
  const dbUser = process.env.DB_USER;
  const dbPassword = process.env.DB_PASSWORD || (await getSSMParameter("/fiap-soat/db/password"));

  cachedClient = new Client({
    host: dbHost,
    port: dbPort,
    database: dbName,
    user: dbUser,
    password: dbPassword,
    ssl: { rejectUnauthorized: false },
  });

  await cachedClient.connect();
  return cachedClient;
}

export async function findUserByDocument(
  document: string
): Promise<UserRecord | null> {
  const client = await getClient();
  const result = await client.query(
    "SELECT id, name, document, email, role FROM users WHERE document = $1 LIMIT 1",
    [document]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as UserRecord;
}
