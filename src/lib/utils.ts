export function parseGitHubUrl(
  url: string
): { owner: string; repo: string } | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname !== "github.com") {
      return null;
    }
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    if (pathParts.length < 2) {
      return null;
    }
    const [owner, repo] = pathParts;
    return { owner, repo: repo.replace(".git", "") };
  } catch (error) {
    console.log("Invalid URL format:", error);
    return null;
  }
}

/**
 * Interprets GitHub error messages to determine appropriate HTTP status codes.
 * @param errorMessage The error message from the GitHub API.
 * @returns The HTTP status code to return based on the error message.
 */

export function interpretGitHubErrorForHttpStatus(errorMessage: string): number {
    if (errorMessage.includes("Status: 404") ||
        errorMessage.includes("Could not determine default branch") ||
        errorMessage.includes("empty repository") ||
        errorMessage.includes("no commit history")) {
        return 404;
    }
    if (errorMessage.startsWith("Repository is too large")) {
        return 413;
    }
    if (errorMessage.includes("Status: 401")) {
        return 401;
    }
    if (errorMessage.includes("Status: 403")) {
        // GitHub returns 403 for both auth-forbidden and rate-limit exhaustion.
        return /rate limit|API rate/i.test(errorMessage) ? 429 : 403;
    }
    const statusMatch = errorMessage.match(/Status: (\d+)/);
    if (statusMatch) {
        const status = parseInt(statusMatch[1], 10);
        if (status >= 500) return 502;
        if (status >= 400) return status;
    }
    return 500;
}