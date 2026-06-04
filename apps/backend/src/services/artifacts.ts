import type { GeneratedArtifact, GeneratedFile } from "../types.js";
import fs from "fs-extra";
import path from "node:path";
import { createZip } from "./zip.js";

export async function exportGeneratedArtifact(repoName: string, files: GeneratedFile[]): Promise<GeneratedArtifact> {
  const fileName = `${repoName}.zip`;
  const zip = createZip(files);
  const bucket = process.env.PROOFPILOT_EXPORT_BUCKET;

  if (bucket) {
    return uploadToGcs(bucket, repoName, fileName, zip);
  }

  const localPath = await writeLocalZip(fileName, zip);
  return {
    mode: "local",
    fileName,
    downloadUrl: localPath,
    localPath,
    sizeBytes: zip.length,
    message: "Generated demo package zip was written locally. Set PROOFPILOT_EXPORT_BUCKET to return a GCP download link."
  };
}

export async function downloadGeneratedArtifact(objectId: string) {
  const bucket = process.env.PROOFPILOT_EXPORT_BUCKET;
  if (!bucket) throw new Error("PROOFPILOT_EXPORT_BUCKET is not configured.");

  const objectName = decodeObjectId(objectId);
  const token = await getGoogleAccessToken();
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?alt=media`;
  const response = await fetch(url, {
    headers: { "Authorization": `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`Could not download generated artifact (${response.status}): ${await response.text()}`);
  }

  return {
    fileName: path.basename(objectName),
    contentType: response.headers.get("content-type") ?? "application/zip",
    data: Buffer.from(await response.arrayBuffer())
  };
}

async function uploadToGcs(bucket: string, repoName: string, fileName: string, zip: Buffer): Promise<GeneratedArtifact> {
  try {
    const objectName = `proofpilot-demos/${repoName}/${fileName}`;
    const token = await getGoogleAccessToken();
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/zip"
      },
      body: new Uint8Array(zip).buffer
    });

    if (!response.ok) {
      throw new Error(`GCS upload failed (${response.status}): ${await response.text()}`);
    }

    return {
      mode: "gcs",
      bucket,
      objectName,
      fileName,
      sizeBytes: zip.length,
      downloadUrl: `/api/exports/${encodeObjectId(objectName)}/download`,
      message: "Generated demo package zip was uploaded to Cloud Storage."
    };
  } catch (err) {
    return {
      mode: "failed",
      fileName,
      downloadUrl: null,
      sizeBytes: zip.length,
      message: err instanceof Error ? err.message : "Generated artifact upload failed."
    };
  }
}

async function writeLocalZip(fileName: string, zip: Buffer) {
  const root = path.resolve(process.cwd(), process.env.PROOFPILOT_LOCAL_EXPORT_DIR ?? "../../.generated/demos");
  const destination = path.join(root, "_downloads", fileName);
  await fs.outputFile(destination, zip);
  return destination;
}

async function getGoogleAccessToken() {
  if (process.env.GOOGLE_OAUTH_ACCESS_TOKEN) return process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
  if (process.env.VERTEX_ACCESS_TOKEN) return process.env.VERTEX_ACCESS_TOKEN;

  const response = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
    headers: { "Metadata-Flavor": "Google" }
  });

  if (!response.ok) {
    throw new Error(`Could not fetch metadata access token (${response.status}).`);
  }

  const token = await response.json() as { access_token?: string };
  if (!token.access_token) throw new Error("Metadata token response did not include access_token.");
  return token.access_token;
}

function encodeObjectId(objectName: string) {
  return Buffer.from(objectName, "utf8").toString("base64url");
}

function decodeObjectId(objectId: string) {
  return Buffer.from(objectId, "base64url").toString("utf8");
}
