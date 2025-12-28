"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseGitHubUrl } from "@/lib/utils";
import { twMerge } from "tailwind-merge";
import Image from "next/image";

type IssueOption = "off" | "top3" | "top5" | "top10" | "all";
type PullOption = "off" | "top3" | "top5";

export default function Inputbox() {
  const [link, setLink] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [issuesOn, setIssuesOn] = useState(false);
  const [prsOn, setPrsOn] = useState(false);
  const [issuesCount, setIssuesCount] = useState<IssueOption>("top3");
  const [prsCount, setPrsCount] = useState<PullOption>("top3");
  const router = useRouter();

  const resolvedParams = useMemo(() => {
    const issues = issuesOn ? issuesCount : "off";
    const prs = prsOn ? prsCount : "off";
    return { issues, prs };
  }, [issuesOn, prsOn, issuesCount, prsCount]);

  const go = () => {
    const parsedUrl = parseGitHubUrl(link);
    if (parsedUrl) {
      const { owner, repo } = parsedUrl;
      setLoading(true);
      const params = new URLSearchParams();
      params.set("issues", resolvedParams.issues);
      params.set("prs", resolvedParams.prs);
      router.push(`/${owner}/${repo}?${params.toString()}`);
    } else {
      setError("Please enter a valid GitHub repository URL.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      go();
    }
  };

  useEffect(() => {
    setError(null);
  }, [link]);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="w-full flex justify-center">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={handleKeyDown}
          type="url"
          disabled={loading}
          placeholder="Enter GitHub repository URL"
          className={twMerge(
            "border-2 backdrop-blur-xl bg-transparent drop-shadow-[0_0_12px]/50 text-center rounded-lg md:rounded-xl px-2 py-1 md:px-4 md:py-2 w-[90%] md:w-[34rem] transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-wait",
            error
              ? "border-red-500 drop-shadow-red-500 text-red-500"
              : "border-primary drop-shadow-[color:var(--primary)] text-primary",
          )}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-foreground/70">
        <button
          type="button"
          aria-pressed={prsOn}
          onClick={() => setPrsOn((v) => !v)}
          className={twMerge(
            "h-8 px-2 flex items-center gap-2 rounded-md border border-foreground/20 backdrop-blur-md transition-[color,background-color,filter]",
            "hover:border-foreground/40 hover:bg-foreground/5",
            prsOn
              ? "bg-foreground text-background border-foreground [&_img]:invert hover:bg-foreground hover:shadow-xl"
              : "opacity-80",
          )}
        >
          <Image src="/icons/pr.svg" alt="Pull Requests" width={16} height={16} />
          Pull Requests
        </button>
        <select
          hidden={!prsOn}
          value={prsCount}
          onChange={(e) => setPrsCount(e.target.value as PullOption)}
          className={twMerge(
            "h-8 px-2 rounded-md border border-foreground/20 bg-background/70 backdrop-blur-md",
            "text-foreground/80",
            !prsOn && "opacity-40 cursor-not-allowed",
          )}
        >
          <option value="top3">Top 3</option>
          <option value="top5">Top 5</option>
        </select>

        <button
          type="button"
          aria-pressed={issuesOn}
          onClick={() => setIssuesOn((v) => !v)}
          className={twMerge(
            "h-8 px-2 flex items-center gap-2 rounded-md border border-foreground/20 backdrop-blur-md transition-[color,background-color,filter]",
            "hover:border-foreground/40 hover:bg-foreground/5",
            issuesOn
              ? "bg-foreground text-background border-foreground [&_img]:invert hover:bg-foreground hover:shadow-xl"
              : "opacity-80",
          )}
        >
          <Image src="/icons/issue.svg" alt="Issues" width={16} height={16} />
          Issues
        </button>
        <select
          hidden={!issuesOn}
          value={issuesCount}
          onChange={(e) => setIssuesCount(e.target.value as IssueOption)}
          className={twMerge(
            "h-8 px-2 rounded-md border border-foreground/20 bg-background/70 backdrop-blur-md",
            "text-foreground/80",
            !issuesOn && "opacity-40 cursor-not-allowed",
          )}
        >
          <option value="top3">Top 3</option>
          <option value="top5">Top 5</option>
          <option value="top10">Top 10</option>
          <option value="all">All</option>
        </select>
      </div>
    </div>
  );
}
