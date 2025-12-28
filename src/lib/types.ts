export type GitHubApiFile = {
  path: string;
  type: "blob" | "tree";
};

export interface TreeNode {
  type: "tree" | "blob";
  name: string;
  path: string;
  children?: TreeNode[];
}

export interface RepositoryFilesTree {
  owner: string;
  repo: string;
  defaultBranch: string;
  tree: TreeNode;
}

export type FileItem = {
  name: string;
  path: string;
  content: string;
};

export interface ActionError {
  error: string;
}

export interface MarkdownSuccess {
  markdown: string;
}

export type IssueOption = "off" | "top3" | "top5" | "top10" | "all";
export type PullRequestOption = "off" | "top3" | "top5";

export interface FetchOptions {
  issues: IssueOption;
  pullRequests: PullRequestOption;
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: "open" | "closed";
  body: string | null;
  comments: number;
  user: { login: string };
  created_at: string;
  labels: { name: string }[];
  html_url: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
  body: string | null;
  comments: number;
  user: { login: string };
  created_at: string;
  html_url: string;
  merged_at: string | null;
}
