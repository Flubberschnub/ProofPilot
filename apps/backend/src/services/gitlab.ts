import type { GeneratedFile } from "../types.js";

export async function exportToGitLab(repoName: string, files: GeneratedFile[]) {
  const mock = process.env.MOCK_MODE !== "false" || !process.env.GITLAB_TOKEN;

  if (mock) {
    return {
      mode: "mock",
      repoName,
      filesCommitted: files.length,
      url: `https://gitlab.com/example/${repoName}`,
      message: "Mock GitLab export. Set MOCK_MODE=false and GITLAB_TOKEN to enable real export."
    };
  }

  // TODO: Replace with GitLab MCP/API implementation.
  // Suggested implementation:
  // 1. POST /projects to create repo
  // 2. POST /repository/commits with actions[] for generated files
  // 3. POST /merge_requests if targeting existing repo/branch
  return {
    mode: "not_implemented",
    repoName,
    filesCommitted: 0,
    url: null,
    message: "Real GitLab export is not implemented in this scaffold."
  };
}
