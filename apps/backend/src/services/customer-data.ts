import fs from "fs-extra";
import path from "node:path";

export type LoadedCustomerDocument = {
  path: string;
  text: string;
};

const supportedExtensions = new Set([".md", ".json", ".txt", ".yaml", ".yml"]);

export async function loadSampleCustomerDocuments(customerId?: string): Promise<LoadedCustomerDocument[]> {
  if (!customerId) return [];

  const root = await resolveSampleCustomerRoot(customerId);
  if (!root) return [];

  const files = await listFiles(root);
  const documents: LoadedCustomerDocument[] = [];
  for (const file of files) {
    if (!supportedExtensions.has(path.extname(file).toLowerCase())) continue;
    const text = await fs.readFile(file, "utf8");
    documents.push({
      path: path.relative(root, file).replace(/\\/g, "/"),
      text
    });
  }

  return documents;
}

async function resolveSampleCustomerRoot(customerId: string) {
  const candidates = [
    path.resolve(process.cwd(), "sample-data", customerId),
    path.resolve(process.cwd(), "..", "..", "sample-data", customerId),
    path.resolve(process.cwd(), "..", "sample-data", customerId)
  ];

  for (const candidate of candidates) {
    if (await fs.pathExists(candidate)) return candidate;
  }

  return null;
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  }));

  return files.flat();
}
