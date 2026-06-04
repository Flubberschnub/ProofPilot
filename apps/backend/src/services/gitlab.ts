import type { GeneratedFile, GitLabExportResult } from "../types.js";
import fs from "fs-extra";
import path from "node:path";
import { exportGeneratedArtifact } from "./artifacts.js";

type GitLabProject = {
  id: number;
  web_url: string;
};

export async function exportToGitLab(repoName: string, files: GeneratedFile[]): Promise<GitLabExportResult> {
  const artifact = await exportGeneratedArtifact(repoName, files);
  const mock = process.env.MOCK_MODE !== "false" || !process.env.GITLAB_TOKEN;

  if (mock) {
    const localPath = await exportLocally(repoName, files);
    return {
      mode: "mock",
      repoName,
      filesCommitted: files.length,
      url: localPath,
      localPath,
      artifact,
      message: "Mock GitLab export wrote files locally. Set MOCK_MODE=false and GITLAB_TOKEN to enable real export."
    };
  }

  const baseUrl = gitlabApiBaseUrl();
  const token = process.env.GITLAB_TOKEN;
  const namespaceId = process.env.GITLAB_NAMESPACE_ID;

  if (!token) {
    return {
      mode: "not_configured",
      repoName,
      filesCommitted: 0,
      url: null,
      artifact,
      message: "GITLAB_TOKEN is required for live GitLab export."
    };
  }

  try {
    const project = await createProject(baseUrl, token, repoName, namespaceId);
    await createCommit(baseUrl, token, project.id, files);

    return {
      mode: "live",
      repoName,
      projectId: project.id,
      filesCommitted: files.length,
      url: project.web_url,
      artifact,
      message: "Generated demo package exported to GitLab."
    };
  } catch (err) {
    return {
      mode: "failed",
      repoName,
      filesCommitted: 0,
      url: null,
      artifact,
      message: err instanceof Error ? err.message : "GitLab export failed."
    };
  }
}

async function createProject(baseUrl: string, token: string, repoName: string, namespaceId?: string): Promise<GitLabProject> {
  const response = await fetch(`${baseUrl}/projects`, {
    method: "POST",
    headers: gitlabHeaders(token),
    body: JSON.stringify({
      name: repoName,
      path: repoName,
      namespace_id: namespaceId ? Number(namespaceId) : undefined,
      visibility: process.env.GITLAB_VISIBILITY ?? "private",
      initialize_with_readme: false
    })
  });

  if (!response.ok) {
    throw new Error(`GitLab project creation failed (${response.status}): ${await response.text()}`);
  }

  return await response.json() as GitLabProject;
}

async function createCommit(baseUrl: string, token: string, projectId: number, files: GeneratedFile[]) {
  const response = await fetch(`${baseUrl}/projects/${encodeURIComponent(String(projectId))}/repository/commits`, {
    method: "POST",
    headers: gitlabHeaders(token),
    body: JSON.stringify({
      branch: process.env.GITLAB_BRANCH ?? "main",
      commit_message: "Add generated ProofPilot demo",
      actions: files.map((file) => ({
        action: "create",
        file_path: file.path,
        content: file.content
      }))
    })
  });

  if (!response.ok) {
    throw new Error(`GitLab commit failed (${response.status}): ${await response.text()}`);
  }
}

function gitlabApiBaseUrl() {
  const base = process.env.GITLAB_BASE_URL ?? "https://gitlab.com";
  return base.endsWith("/api/v4") ? base : `${base.replace(/\/$/, "")}/api/v4`;
}

function gitlabHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    "PRIVATE-TOKEN": token
  };
}

async function exportLocally(repoName: string, files: GeneratedFile[]) {
  const root = path.resolve(process.cwd(), process.env.PROOFPILOT_LOCAL_EXPORT_DIR ?? "../../.generated/demos");
  const destination = path.resolve(root, repoName);
  await fs.ensureDir(destination);

  for (const file of files) {
    const relativePath = safeRelativePath(file.path);
    await fs.outputFile(path.join(destination, relativePath), file.content, "utf8");
  }

  return destination;
}

function safeRelativePath(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/");
  if (path.isAbsolute(normalized) || normalized.split("/").includes("..")) {
    throw new Error(`Generated file path is not safe to export: ${filePath}`);
  }
  return normalized;
}
