import fs from "fs-extra";
import path from "node:path";
import { previewCache } from "../workflow.js";
import { getGoogleAccessToken } from "./artifacts.js";

const PREVIEW_DIR = path.resolve(process.cwd(), ".generated/previews");

export async function saveDemoPreview(
  demoId: string,
  data: { apiName: string; appCode: string; cssCode: string }
) {
  // 1. Save to in-memory cache
  previewCache.set(demoId, data);

  // 2. Save to GCS if bucket is configured
  const bucket = process.env.PROOFPILOT_EXPORT_BUCKET;
  if (bucket) {
    try {
      const objectName = `proofpilot-previews/${demoId}.json`;
      const token = await getGoogleAccessToken();
      const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        console.error(`GCS preview upload failed (${response.status}): ${await response.text()}`);
      }
    } catch (err) {
      console.error("GCS preview upload failed:", err);
    }
  } else {
    // 3. Save to local disk
    try {
      await fs.outputJson(path.join(PREVIEW_DIR, `${demoId}.json`), data);
    } catch (err) {
      console.error("Local preview write failed:", err);
    }
  }
}

export async function getDemoPreview(demoId: string): Promise<{ apiName: string; appCode: string; cssCode: string } | undefined> {
  // 1. Try in-memory cache
  if (previewCache.has(demoId)) {
    return previewCache.get(demoId);
  }

  // 2. Try GCS if bucket is configured
  const bucket = process.env.PROOFPILOT_EXPORT_BUCKET;
  if (bucket) {
    try {
      const objectName = `proofpilot-previews/${demoId}.json`;
      const token = await getGoogleAccessToken();
      const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?alt=media`;
      
      const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json() as any;
        previewCache.set(demoId, data); // cache in memory
        return data;
      }
    } catch (err) {
      console.error("GCS preview fetch failed:", err);
    }
  } else {
    // 3. Try local disk
    try {
      const file = path.join(PREVIEW_DIR, `${demoId}.json`);
      if (await fs.pathExists(file)) {
        const data = await fs.readJson(file) as any;
        previewCache.set(demoId, data); // cache in memory
        return data;
      }
    } catch (err) {
      console.error("Local preview read failed:", err);
    }
  }

  return undefined;
}
