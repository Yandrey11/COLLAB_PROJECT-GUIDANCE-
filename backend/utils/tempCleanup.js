import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.resolve(path.join(__dirname, "..", "temp"));

export async function cleanupTempFiles({ ttlHours = 24 } = {}) {
  const ttlMs = Math.max(1, Number(ttlHours) || 24) * 60 * 60 * 1000;
  const cutoff = Date.now() - ttlMs;

  try {
    const entries = await fs.readdir(tempDir, { withFileTypes: true });
    let deleted = 0;

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fullPath = path.join(tempDir, entry.name);
      const stat = await fs.stat(fullPath);
      if (stat.mtimeMs < cutoff) {
        await fs.unlink(fullPath);
        deleted += 1;
      }
    }

    return { deleted };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { deleted: 0 };
    }
    throw error;
  }
}

