// backend/purge-all.js
import { config } from 'dotenv';
import { OpenAI } from 'openai';

config(); // charge .env à la racine du projet
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function listAllFiles() {
  const out = [];
  let after = undefined, limit = 100;
  for (;;) {
    const page = await client.files.list({ limit, after });
    const data = Array.isArray(page?.data) ? page.data : [];
    out.push(...data);
    if (!page?.has_more) break;
    const lastId = page?.last_id ?? (data.length ? data[data.length - 1]?.id : null);
    if (!lastId) break;
    after = lastId;
  }
  return out;
}

async function listAllVectorStores() {
  if (!client?.vectorStores?.list) return [];
  const out = [];
  let after = undefined, limit = 100;
  for (;;) {
    const page = await client.vectorStores.list({ limit, after });
    const data = Array.isArray(page?.data) ? page.data : [];
    out.push(...data);
    if (!page?.has_more) break;
    const lastId = page?.last_id ?? (data.length ? data[data.length - 1]?.id : null);
    if (!lastId) break;
    after = lastId;
  }
  return out;
}

async function purgeAllVectorStores() {
  const vs = await listAllVectorStores();
  console.log(`VectorStores avant purge: ${vs.length}`);
  if (!vs.length) return { deleted: 0, errors: [] };

  const errors = [];
  await Promise.all(
    vs.map(async (v) => {
      try {
        const resp = await client.vectorStores.delete(v.id);
        console.log('[VS deleted]', { id: v.id, resp });
      } catch (e) {
        console.warn('[VS delete error]', {
          id: v.id,
          status: e?.status,
          message: e?.message,
          data: e?.response?.data,
        });
        errors.push({ id: v.id, status: e?.status, message: e?.message, data: e?.response?.data });
      }
    })
  );
  const after = await listAllVectorStores();
  console.log(`VectorStores après purge: ${after.length}`);
  return { deleted: vs.length - errors.length, errors };
}

async function purgeAllFiles() {
  const files = await listAllFiles();
  console.log(`Files avant purge: ${files.length}`);
  if (!files.length) return { deleted: 0, errors: [] };

  const errors = [];
  await Promise.all(
    files.map(async (f) => {
      try {
        const resp = await client.files.delete(f.id);
        console.log('[File deleted]', { id: f.id, resp });
      } catch (e) {
        console.warn('[File delete error]', {
          id: f.id,
          status: e?.status,
          message: e?.message,
          data: e?.response?.data,
        });
        errors.push({ id: f.id, status: e?.status, message: e?.message, data: e?.response?.data });
      }
    })
  );
  const after = await listAllFiles();
  console.log(`Files après purge: ${after.length}`);
  return { deleted: files.length - errors.length, errors };
}

async function main() {
  console.log('[OpenAI Config]', {
    keySuffix: process.env.OPENAI_API_KEY?.slice(-6) || 'none',
  });

  console.log('\n--- PURGE VECTOR STORES ---');
  const vsRes = await purgeAllVectorStores();

  console.log('\n--- PURGE FILES ---');
  const filesRes = await purgeAllFiles();

  console.log('\nRésumé:', { vectorStoresDeleted: vsRes.deleted, filesDeleted: filesRes.deleted });
  if (vsRes.errors.length || filesRes.errors.length) {
    console.log('\nErreurs:', { vs: vsRes.errors, files: filesRes.errors });
  }
}

main().catch((e) => {
  console.error('Purge-all failed:', e?.status, e?.message, e?.response?.data);
  process.exit(1);
});