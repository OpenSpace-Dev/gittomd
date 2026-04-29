import { generateMarkdownForFiles, getRepoFilesTree } from "@/lib/github";
import { after, NextRequest, NextResponse } from "next/server";
import type {
  ActionError,
  FetchOptions,
  IssueOption,
  PullRequestOption,
} from "@/lib/types";
import { interpretGitHubErrorForHttpStatus } from "@/lib/utils";
import { cacheData, getFromCache } from "@/lib/redis";

// GitHub usernames: 1–39 chars, alphanumeric or hyphen, may not start with hyphen.
// Repo names: 1–100 chars, alphanumerics plus . _ -, may not start with . or -.
// We use a permissive shape that covers both and rejects path traversal / control chars.
const GITHUB_NAME_RE = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,99}$/;

const baseMarkdownHeaders = {
  "Content-Type": "text/markdown; charset=utf-8",
  "Cache-Control":
    "public, s-maxage=600, max-age=300, stale-while-revalidate=1800, stale-if-error=3600",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

const buildMarkdownHeaders = (
  download: boolean,
  owner: string,
  repo: string,
): Record<string, string> => {
  const headers: Record<string, string> = { ...baseMarkdownHeaders };
  if (download) {
    headers["Content-Disposition"] = `attachment; filename="${owner}-${repo}.md"`;
  }
  return headers;
};

const responseJson = (data: unknown, status: number) => {
  return NextResponse.json(data, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
};
/**
 * This route handles requests to generate a markdown file from a GitHub repository.
 * It expects the first two path segments after the base API path to be the GitHub owner and repository name.
 *
 * Example: /owner/repo
 *
 * It retrieves the file tree of the specified repository, generates markdown content for the files,
 * and returns it in the response.
 */
export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const pathSegments = pathname.split("/").slice(1);
  const owner = pathSegments[0];
  const repo = pathSegments[1];

  if (
    !owner ||
    !repo ||
    typeof owner !== "string" ||
    typeof repo !== "string"
  ) {
    return responseJson(
      {
        error:
          "GitHub owner and repository name must be provided as the first two path segments after the base API path.",
      },
      400,
    );
  }

  if (!GITHUB_NAME_RE.test(owner) || !GITHUB_NAME_RE.test(repo)) {
    return responseJson(
      { error: "Invalid GitHub owner or repository name." },
      400,
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const issuesParam = searchParams.get("issues") as IssueOption | null;
  const prsParam = searchParams.get("prs") as PullRequestOption | null;
  const download = searchParams.get("download") === "1";

  const validIssueOptions: IssueOption[] = [
    "off",
    "top3",
    "top5",
    "top10",
    "all",
  ];
  const validPrOptions: PullRequestOption[] = ["off", "top3", "top5"];

  const options: FetchOptions = {
    issues: validIssueOptions.includes(issuesParam as IssueOption)
      ? (issuesParam as IssueOption)
      : "off",
    pullRequests: validPrOptions.includes(prsParam as PullRequestOption)
      ? (prsParam as PullRequestOption)
      : "off",
  };

  const optionsKey = `issues=${options.issues}:prs=${options.pullRequests}`;
  const markdownHeaders = buildMarkdownHeaders(download, owner, repo);

  // Try get from cache first
  const cachedData = await getFromCache(owner, repo, optionsKey);
  if (cachedData) {
    return new NextResponse(cachedData, { headers: markdownHeaders });
  }

  const treeResult = await getRepoFilesTree(owner, repo);

  if ("error" in treeResult) {
    const actionError = treeResult as ActionError;
    const status = interpretGitHubErrorForHttpStatus(actionError.error);
    return responseJson({ error: actionError.error }, status);
  }

  const markdownResult = await generateMarkdownForFiles(treeResult, options);

  if ("error" in markdownResult) {
    const actionError = markdownResult as ActionError;
    const status = interpretGitHubErrorForHttpStatus(actionError.error);
    return responseJson({ error: actionError.error }, status);
  }

  after(() => {
    // Cache the markdown result
    cacheData(owner, repo, markdownResult.markdown, optionsKey).catch(
      (error) => {
        console.error("Error caching data:", error);
      },
    );
  });

  return new NextResponse(markdownResult.markdown, { headers: markdownHeaders });
}
