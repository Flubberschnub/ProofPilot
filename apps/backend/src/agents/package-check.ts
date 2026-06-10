import type { GeneratedFile, GeneratedPackageCheck } from "../types.js";

const requiredFiles = [
  "README.md",
  "demo-script.md",
  "claim-check-report.md",
  "frontend/package.json",
  "frontend/index.html",
  "frontend/src/main.tsx",
  "frontend/src/App.tsx",
  "frontend/src/style.css",
  "backend/package.json",
  "backend/src/server.js"
];

export function validateGeneratedPackage(files: GeneratedFile[]): GeneratedPackageCheck {
  const checks: GeneratedPackageCheck["checks"] = [];
  const fileMap = new Map(files.map((file) => [normalizePath(file.path), file]));

  for (const path of requiredFiles) {
    checks.push(fileMap.has(path)
      ? { name: `required:${path}`, status: "passed", message: `${path} was generated.` }
      : { name: `required:${path}`, status: "failed", message: `${path} is missing.` });
  }

  for (const packagePath of ["frontend/package.json", "backend/package.json"]) {
    const file = fileMap.get(packagePath);
    if (!file) continue;
    try {
      JSON.parse(file.content);
      checks.push({ name: `json:${packagePath}`, status: "passed", message: `${packagePath} contains valid JSON.` });
    } catch (err) {
      checks.push({
        name: `json:${packagePath}`,
        status: "failed",
        message: err instanceof Error ? err.message : `${packagePath} contains invalid JSON.`
      });
    }
  }

  const appFile = fileMap.get("frontend/src/App.tsx");
  checks.push(appFile?.content.includes("Source-grounded claims")
    ? { name: "demo:claims", status: "passed", message: "Generated app renders source-grounded claims." }
    : { name: "demo:claims", status: "warning", message: "Generated app may not expose claim review copy." });

  return {
    status: checks.some((check) => check.status === "failed")
      ? "failed"
      : checks.some((check) => check.status === "warning")
        ? "warning"
        : "passed",
    checks
  };
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/");
}
