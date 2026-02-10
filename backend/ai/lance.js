// backend/ai/lance.js
import * as lancedb from '@lancedb/lancedb';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

const dir = process.env.LANCEDB_DIR || path.resolve('ai/db');
const TABLE_NAME = process.env.LANCEDB_TABLE || 'kb';
const DEFAULT_EMBED_DIM = Number(process.env.EMBED_DIM || 768);

const makeId = () => (typeof randomUUID === 'function' ? randomUUID() : Math.random().toString(36).slice(2));

let table;
export async function getTable() {
  if (table) return table;

  await fs.promises.mkdir(dir, { recursive: true });
  const db = await lancedb.connect(dir);

  const names = await db.tableNames();
  if (!names.includes(TABLE_NAME)) {
    // seed với đúng dimension, tránh undefined ở mọi cột string
    const seed = {
      id: makeId(),
      title: 'seed',
      text: 'seed',
      tags: ['seed'],
      embedding: Array(DEFAULT_EMBED_DIM).fill(0),
      createdAt: new Date().toISOString()
    };
    table = await db.createTable(TABLE_NAME, [seed], { mode: 'create' });
    await table.delete(); // xóa seed ⇒ bảng rỗng nhưng schema đã đúng
  } else {
    table = await db.openTable(TABLE_NAME);
  }

  return table;
}
