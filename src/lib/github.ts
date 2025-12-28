import type {
  RepositoryFilesTree,
  ActionError,
  MarkdownSuccess,
  GitHubApiFile,
  TreeNode,
  FileItem,
  FetchOptions,
  GitHubIssue,
  GitHubPullRequest,
  IssueOption,
  PullRequestOption,
} from "./types";
import { processFile, createTreeStructure } from "./files";

const GITHUB_API_BASE_URL = "https://api.github.com";
const GITHUB_RAW_CONTENT_BASE_URL = "https://raw.githubusercontent.com";

const credentials = `${process.env.GITHUB_CLIENT_ID}:${process.env.GITHUB_API_TOKEN}`;
const encodedCredentials = Buffer.from(credentials).toString("base64");

const commonHeaders: HeadersInit = {
  Accept: "application/vnd.github.v3+json",
  "X-GitHub-Api-Version": "2022-11-28",
  Authorization: `Basic ${encodedCredentials}`,
  "X-GitHub-Client-ID": process.env.GITHUB_CLIENT_ID || "",
};
const rawContentHeaders: HeadersInit = {
  Accept: "text/plain",
};

// Multiplier for fetching extra issues to account for PRs being filtered out
const ISSUE_FETCH_MULTIPLIER = 2.5;

/**
 * Builds a hierarchical tree structure from a flat list of GitHub API file objects.
 * @param apiFiles - An array of file objects from the GitHub API, each with a path and type.
 * @param repoName - The name of the repository to use as the root node's name.
 * @returns A TreeNode representing the hierarchical structure of files and directories.
 */
function buildTreeFromFlatList(
  apiFiles: { path: string; type: "blob" | "tree" }[],
  repoName: string,
): TreeNode {
  const root: TreeNode = {
    name: repoName,
    type: "tree",
    path: "",
    children: [],
  };
  const sortedApiFiles = [...apiFiles].sort((a, b) =>
    a.path.localeCompare(b.path),
  );

  for (const item of sortedApiFiles) {
    const parts = item.path.split("/");
    let currentNode = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      let childNode = currentNode.children?.find((c) => c.name === part);

      if (!childNode) {
        const isLastPart = i === parts.length - 1;
        const type = isLastPart ? item.type : "tree";
        const currentPath = parts.slice(0, i + 1).join("/");

        childNode = {
          name: part,
          path: currentPath,
          type: type,
        };
        if (type === "tree") {
          childNode.children = [];
        }
        if (!currentNode.children) currentNode.children = [];
        currentNode.children.push(childNode);
      } else {
        const isLastPart = i === parts.length - 1;
        if (!isLastPart && childNode.type === "blob") {
          console.warn(
            `Path conflict: Node "${childNode.path}" was a blob but is part of a longer path. Correcting to 'tree'.`,
          );
          childNode.type = "tree";
          if (!childNode.children) childNode.children = [];
        }
      }
      currentNode = childNode;
    }
  }
  return root;
}

/**
 *  Fetches the file tree of a GitHub repository and returns it in a structured format.
 *  The tree is represented as a nested structure of directories and files.
 *  @param owner - The GitHub username or organization name.
 *  @param repo - The name of the repository.
 *  @return A promise that resolves to a RepositoryFilesTree object or an ActionError if the request fails.
 *  The RepositoryFilesTree contains the owner, repo name, default branch, and a tree structure of files
 */
export async function getRepoFilesTree(
  owner: string,
  repo: string,
): Promise<RepositoryFilesTree | ActionError> {
  let defaultBranch: string;
  try {
    const repoDetailsResponse = await fetch(
      `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}`,
      {
        headers: commonHeaders,
        cache: "force-cache",
        next: {
          revalidate: 21600,
        },
      },
    );
    if (!repoDetailsResponse.ok) {
      const errorData = await repoDetailsResponse.json().catch(() => ({}));
      const message = errorData.message || repoDetailsResponse.statusText;
      return {
        error: `Failed to fetch repo details for ${owner}/${repo}: ${message} (Status: ${repoDetailsResponse.status})`,
      };
    }
    const repoData = await repoDetailsResponse.json();
    defaultBranch = repoData.default_branch;

    if (!defaultBranch) {
      return {
        error: `Could not determine default branch for ${owner}/${repo}. The repository might be empty or uninitialized.`,
      };
    }
  } catch (e: any) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return {
      error: `Network or parsing error fetching repo details: ${errorMessage}`,
    };
  }

  try {
    const treeResponse = await fetch(
      `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
      {
        headers: commonHeaders,
        cache: "force-cache",
        next: {
          revalidate: 21600,
        },
      },
    );
    if (!treeResponse.ok) {
      const errorData = await treeResponse.json().catch(() => ({}));
      const message = errorData.message || treeResponse.statusText;
      if (
        treeResponse.status === 404 ||
        (treeResponse.status === 409 && message?.includes("empty"))
      ) {
        console.warn(
          `Repository ${owner}/${repo} (branch: ${defaultBranch}) appears to be empty or has no commit history. Proceeding with an empty file tree.`,
        );
        return {
          owner,
          repo,
          defaultBranch, // Include defaultBranch here
          tree: { name: repo, type: "tree", path: "", children: [] },
        };
      }
      return {
        error: `Failed to fetch repository tree for ${owner}/${repo} (branch: ${defaultBranch}): ${message} (Status: ${treeResponse.status})`,
      };
    }
    const treeData = await treeResponse.json();

    if (treeData.truncated) {
      return {
        error:
          "Repository is too large; the file tree was truncated by the GitHub API. Full processing is not possible with this method.",
      };
    }

    const apiFiles: GitHubApiFile[] = treeData.tree
      .filter(
        (item: any) =>
          (item.type === "blob" || item.type === "tree") && item.path,
      )
      .map((item: any) => ({
        path: item.path,
        type: item.type as "blob" | "tree",
      }));

    const fileTree = buildTreeFromFlatList(apiFiles, repo);

    return {
      owner,
      repo,
      defaultBranch,
      tree: fileTree,
    };
  } catch (e: any) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return {
      error: `Network or parsing error fetching repository tree: ${errorMessage}`,
    };
  }
}

async function fetchIssues(
  owner: string,
  repo: string,
  option: IssueOption,
): Promise<GitHubIssue[]> {
  if (option === "off") return [];

  // Map option to desired limit
  const limitMap: Record<IssueOption, number> = {
    off: 0,
    top3: 3,
    top5: 5,
    top10: 10,
    all: 100,
  };
  const limit = limitMap[option];

  // Calculate optimal fetch size: multiply by ISSUE_FETCH_MULTIPLIER to account for PRs
  // (which are filtered out), but cap at 100
  const perPage = option === "all" ? 100 : Math.min(Math.ceil(limit * ISSUE_FETCH_MULTIPLIER), 100);
  
  const url = `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/issues?state=all&sort=comments&direction=desc&per_page=${perPage}`;

  try {
    const response = await fetch(url, {
      headers: commonHeaders,
      next: { revalidate: 3600 },
    });
    if (!response.ok) return [];
    const data = await response.json();

    // Filter out pull requests (GitHub API returns PRs in issues endpoint)
    const issues = data.filter(
      (item: any) => !item.pull_request,
    ) as GitHubIssue[];

    if (option === "all") return issues;
    return issues.slice(0, limit);
  } catch (e) {
    console.error("Error fetching issues:", e);
    return [];
  }
}

async function fetchPullRequests(
  owner: string,
  repo: string,
  option: PullRequestOption,
): Promise<GitHubPullRequest[]> {
  if (option === "off") return [];

  // Sort by popularity (comment count)
  const url = `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/pulls?state=all&sort=popularity&direction=desc&per_page=20`;

  try {
    const response = await fetch(url, {
      headers: commonHeaders,
      next: { revalidate: 3600 },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as GitHubPullRequest[];

    const limit = option === "top3" ? 3 : 5;
    return data.slice(0, limit);
  } catch (e) {
    console.error("Error fetching PRs:", e);
    return [];
  }
}

function generateIssuesMarkdown(issues: GitHubIssue[]): string {
  if (issues.length === 0) return "";

  const parts = ["## Issues"];

  for (const issue of issues) {
    const stateIcon = issue.state === "open" ? "🟢" : "🔴";
    const labels = issue.labels.map((l) => l.name).join(", ");

    parts.push(
      `### #${issue.number} - ${issue.title} (${stateIcon} ${issue.state}, 💬 ${issue.comments})`,
    );
    if (labels) parts.push(`**Labels:** ${labels}`);
    parts.push(`> ${issue.html_url}`);
    parts.push("");
    parts.push(issue.body || "*No description provided.*");
    parts.push("---");
  }

  return parts.join("\n\n");
}

function generatePullRequestsMarkdown(prs: GitHubPullRequest[]): string {
  if (prs.length === 0) return "";

  const parts = ["## Pull Requests"];

  for (const pr of prs) {
    const stateIcon = pr.state === "open" ? "🟢" : pr.merged_at ? "🟣" : "🔴";
    const stateLabel = pr.merged_at ? "merged" : pr.state;

    parts.push(
      `### #${pr.number} - ${pr.title} (${stateIcon} ${stateLabel}, 💬 ${pr.comments})`,
    );
    parts.push(`> ${pr.html_url}`);
    parts.push("");
    parts.push(pr.body || "*No description provided.*");
    parts.push("---");
  }

  return parts.join("\n\n");
}

/**
 * Generates a Markdown representation of the file structure of a GitHub repository.
 * @param repofiles - The RepositoryFilesTree object containing the file structure of a GitHub repository.
 * This function generates a Markdown representation of the repository's file structure,
 * @returns A promise that resolves to a MarkdownSuccess object containing the generated Markdown,
 * or an ActionError if an error occurs during the generation process.
 */
export async function generateMarkdownForFiles(
  repoFiles: RepositoryFilesTree,
  options?: FetchOptions,
): Promise<MarkdownSuccess | ActionError> {
  const markdownParts: string[] = [];

  markdownParts.push(`# ${repoFiles.owner} - ${repoFiles.repo}`);

  try {
    const treeStructureMarkdown = createTreeStructure(repoFiles.tree);
    markdownParts.push("## Structure");
    markdownParts.push(treeStructureMarkdown);
  } catch (e: any) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return { error: `Error generating tree structure: ${errorMessage}` };
  }

  if (options) {
    if (options.issues !== "off") {
      const issues = await fetchIssues(
        repoFiles.owner,
        repoFiles.repo,
        options.issues,
      );
      const issuesMd = generateIssuesMarkdown(issues);
      if (issuesMd) markdownParts.push(issuesMd);
    }
    if (options.pullRequests !== "off") {
      const prs = await fetchPullRequests(
        repoFiles.owner,
        repoFiles.repo,
        options.pullRequests,
      );
      const prsMd = generatePullRequestsMarkdown(prs);
      if (prsMd) markdownParts.push(prsMd);
    }
  }

  const filesToFetchContentFor: { path: string; name: string }[] = [];

  function collectAllBlobFilesRecursively(node: TreeNode) {
    if (node.type === "blob") {
      filesToFetchContentFor.push({ path: node.path, name: node.name });
    } else if (node.type === "tree" && node.children) {
      const sortedChildren = [...node.children].sort((a, b) => {
        if (a.type === "tree" && b.type === "blob") return -1;
        if (a.type === "blob" && b.type === "tree") return 1;
        return a.name.localeCompare(b.name);
      });
      for (const child of sortedChildren) {
        collectAllBlobFilesRecursively(child);
      }
    }
  }

  if (repoFiles.tree) {
    collectAllBlobFilesRecursively(repoFiles.tree);
  }

  // Sort files so that README.md is processed first, then others
  filesToFetchContentFor.sort((a, b) => {
    if (a.path === "README.md") return -1;
    if (b.path === "README.md") return 1;
    return a.path.localeCompare(b.path);
  });

  const fileProcessingPromises = filesToFetchContentFor.map(
    async (fileData) => {
      let contentValue = "";
      try {
        const rawFileUrlPath = `${repoFiles.owner}/${repoFiles.repo}/${repoFiles.defaultBranch}/${fileData.path}`;
        const rawFileUrl = new URL(
          rawFileUrlPath,
          GITHUB_RAW_CONTENT_BASE_URL,
        ).toString();

        const contentResponse = await fetch(rawFileUrl, {
          headers: rawContentHeaders,
          cache: "force-cache",
          next: {
            revalidate: 21600,
          },
        });

        if (!contentResponse.ok) {
          console.warn(
            `Failed to fetch raw content for ${fileData.path} from ${rawFileUrl}: ${contentResponse.status} ${contentResponse.statusText}. Processing with empty content.`,
          );
        } else {
          contentValue = await contentResponse.text();
        }

        const fileItem: FileItem = {
          name: fileData.name,
          path: fileData.path,
          content: contentValue,
        };

        return processFile(fileItem);
      } catch (e: any) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error(
          `Error fetching or processing raw content for ${fileData.path}: ${errorMessage}`,
        );
        return "";
      }
    },
  );

  try {
    const processedFileMarkdowns = await Promise.all(fileProcessingPromises);
    markdownParts.push(
      ...processedFileMarkdowns.filter((md) => md && md.length > 0),
    );
  } catch (e: any) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return {
      error: `A critical error occurred during file processing: ${errorMessage}`,
    };
  }

  return { markdown: markdownParts.join("\n\n") };
}
