import type { FileItem, TreeNode } from "./types";

const MAX_FILE_BYTES = 256 * 1024; // 256 KB hard cap per file
const MAX_AVG_LINE_LENGTH = 500; // heuristic for minified content
const BINARY_SCAN_BYTES = 8 * 1024; // bytes of head to scan for NUL

const KNOWN_TEXT_EXTENSIONS: Set<string> = new Set([
  // Docs / markup
  ".md", ".mdx", ".markdown", ".rst", ".adoc", ".asciidoc", ".tex", ".bib",
  ".txt", ".log",
  // Web
  ".html", ".htm", ".css", ".scss", ".sass", ".less", ".styl",
  ".vue", ".svelte", ".astro",
  // Data / config
  ".json", ".jsonc", ".json5", ".yaml", ".yml", ".xml", ".toml",
  ".ini", ".cfg", ".conf", ".properties", ".editorconfig", ".env",
  ".csv", ".tsv",
  // VCS metadata that's useful for LLM context
  ".gitignore", ".gitattributes", ".gitmodules",
  // JS / TS
  ".js", ".jsx", ".cjs", ".mjs", ".ts", ".tsx", ".cts", ".mts",
  // Other mainstream
  ".py", ".pyi", ".rb", ".php", ".java",
  ".c", ".h", ".cpp", ".hpp", ".cc", ".hh", ".cxx", ".hxx",
  ".cs", ".go", ".rs", ".swift", ".kt", ".kts", ".scala",
  // Shell / scripting
  ".sh", ".bash", ".zsh", ".fish",
  ".ps1", ".psm1", ".bat", ".cmd",
  ".pl", ".pm", ".r", ".jl", ".lua", ".dart",
  // SQL / API
  ".sql", ".graphql", ".gql", ".proto", ".thrift",
  // Infra
  ".tf", ".tfvars", ".hcl", ".dockerfile", ".dockerignore", ".cmake", ".nix",
  // Functional / niche
  ".ex", ".exs", ".erl", ".hrl",
  ".clj", ".cljs", ".cljc", ".lisp", ".scm", ".rkt",
  ".hs", ".lhs", ".ml", ".mli", ".fs", ".fsi", ".fsx",
  ".elm", ".nim", ".zig", ".v", ".sv",
  ".d", ".pas", ".f90", ".f95", ".for", ".ada", ".adb", ".ads",
  // Go modules
  ".sum", ".mod",
]);

// Files with no extension that should be treated as text (matched case-insensitively).
const KNOWN_TEXT_BARENAMES: Set<string> = new Set([
  "readme", "license", "licence", "contributing", "code_of_conduct",
  "changelog", "history", "news", "security",
  "makefile", "dockerfile", "containerfile", "jenkinsfile",
  "vagrantfile", "rakefile", "gemfile", "pipfile", "procfile",
  "requirements", "version", "authors", "copying", "notice", "patents", "todo",
  // Common dotfile configs without extension
  ".babelrc", ".eslintrc", ".prettierrc", ".stylelintrc",
  ".npmrc", ".yarnrc", ".nvmrc", ".tool-versions",
  ".envrc", ".browserslistrc", ".markdownlintrc",
]);

// Path components that, if present anywhere in a file's path, mark it as trash.
const TRASH_PATH_COMPONENTS: Set<string> = new Set([
  // OS / IDE noise
  ".DS_Store", "Thumbs.db",
  ".vscode", ".idea", ".history", ".vs", ".fleet",
  // Lock files (excluded as path components — they're never directories,
  // but split-and-match still works because component equality matches the filename)
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
  "Cargo.lock", "Pipfile.lock", "Gemfile.lock", "composer.lock",
  "poetry.lock", "flake.lock",
  // Build output / vendored / caches
  "node_modules", "dist", "build", "out", "bin", "obj",
  "target", "vendor", "coverage", "__pycache__",
  ".next", ".nuxt", ".cache", ".parcel-cache", ".turbo",
  ".svelte-kit", ".astro", ".docusaurus", ".vercel", ".netlify",
  ".terraform", ".gradle", ".vagrant",
  // Test snapshots (verbose, low LLM signal)
  "__snapshots__",
]);

// Filename patterns (basename only) for trash files that don't fit a simple set.
const TRASH_FILE_PATTERNS: RegExp[] = [
  /\.min\.(js|mjs|cjs|css)$/i,
  /\.bundle\.(js|mjs|cjs|css)$/i,
  /\.map$/i, // source maps
  /\.(pyc|pyo|class|o|a|so|dll|exe|dylib)$/i,
];

// Markdown code-fence language identifiers, keyed by lowercased extension (no dot).
const EXT_TO_LANG: Record<string, string> = {
  js: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", mts: "typescript", cts: "typescript",
  jsx: "jsx", tsx: "tsx",
  py: "python", pyi: "python",
  rb: "ruby", php: "php", java: "java",
  c: "c", h: "c",
  cpp: "cpp", hpp: "cpp", cc: "cpp", hh: "cpp", cxx: "cpp", hxx: "cpp",
  cs: "csharp", go: "go", rs: "rust", swift: "swift",
  kt: "kotlin", kts: "kotlin", scala: "scala",
  sh: "bash", bash: "bash", zsh: "bash", fish: "fish",
  ps1: "powershell", psm1: "powershell",
  bat: "batch", cmd: "batch",
  r: "r", jl: "julia", lua: "lua", dart: "dart",
  pl: "perl", pm: "perl",
  sql: "sql",
  json: "json", jsonc: "json", json5: "json5",
  yaml: "yaml", yml: "yaml", toml: "toml", xml: "xml",
  html: "html", htm: "html",
  css: "css", scss: "scss", sass: "sass", less: "less",
  md: "markdown", mdx: "mdx", markdown: "markdown",
  rst: "rst", adoc: "asciidoc", asciidoc: "asciidoc",
  tex: "latex", bib: "bibtex",
  graphql: "graphql", gql: "graphql",
  proto: "protobuf", thrift: "thrift",
  tf: "hcl", tfvars: "hcl", hcl: "hcl", nix: "nix",
  vue: "vue", svelte: "svelte", astro: "astro",
  ex: "elixir", exs: "elixir", erl: "erlang", hrl: "erlang",
  clj: "clojure", cljs: "clojure", cljc: "clojure",
  hs: "haskell", lhs: "haskell",
  ml: "ocaml", mli: "ocaml",
  fs: "fsharp", fsi: "fsharp", fsx: "fsharp",
  nim: "nim", zig: "zig", v: "v",
  cmake: "cmake",
};

// Code-fence language for files identified by bare filename.
const BARENAME_TO_LANG: Record<string, string> = {
  dockerfile: "dockerfile",
  containerfile: "dockerfile",
  makefile: "makefile",
  jenkinsfile: "groovy",
  vagrantfile: "ruby",
  rakefile: "ruby",
  gemfile: "ruby",
};

function getExtension(fileName: string): string {
  // Treat ".gitignore" as having no extension (leading dot only).
  const idx = fileName.lastIndexOf(".");
  if (idx <= 0) return "";
  return fileName.slice(idx + 1).toLowerCase();
}

function isTextFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  if (KNOWN_TEXT_BARENAMES.has(lower)) return true;
  const ext = getExtension(fileName);
  if (ext && KNOWN_TEXT_EXTENSIONS.has(`.${ext}`)) return true;
  return false;
}

function isTrashPath(filepath: string): boolean {
  const parts = filepath.split("/");
  if (parts.some((p) => TRASH_PATH_COMPONENTS.has(p))) return true;
  const fileName = parts[parts.length - 1] ?? "";
  return TRASH_FILE_PATTERNS.some((re) => re.test(fileName));
}

function isBinaryContent(content: string): boolean {
  const limit = Math.min(content.length, BINARY_SCAN_BYTES);
  for (let i = 0; i < limit; i++) {
    if (content.charCodeAt(i) === 0) return true;
  }
  return false;
}

function isLikelyMinified(content: string): boolean {
  // Skip the heuristic for short files — single-line short files are common.
  if (content.length < 2 * MAX_AVG_LINE_LENGTH) return false;
  const newlineCount = (content.match(/\n/g) ?? []).length;
  const lineCount = newlineCount + 1;
  const avgLen = content.length / lineCount;
  return avgLen > MAX_AVG_LINE_LENGTH;
}

function detectLanguage(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (BARENAME_TO_LANG[lower]) return BARENAME_TO_LANG[lower];
  const ext = getExtension(fileName);
  if (ext && EXT_TO_LANG[ext]) return EXT_TO_LANG[ext];
  return "";
}

/**
 * Decide whether a file should be considered for inclusion based on its name/path
 * alone (no content fetch required). Used both to prune the displayed tree and to
 * avoid wasting bandwidth fetching files we'd reject anyway.
 */
export function shouldIncludeByName(filePath: string, fileName: string): boolean {
  if (isTrashPath(filePath)) return false;
  if (!isTextFile(fileName)) return false;
  return true;
}

/**
 * Returns a copy of the tree with trash paths and non-text leaves removed.
 * Empty directories are dropped. Returns null if nothing remains.
 */
export function pruneTreeForLLM(node: TreeNode): TreeNode | null {
  if (node.type === "blob") {
    return shouldIncludeByName(node.path, node.name) ? { ...node } : null;
  }
  // Directory: prune the whole subtree if any path component is trash.
  if (node.path && isTrashPath(node.path)) return null;
  if (TRASH_FILE_PATTERNS.some((re) => re.test(node.name))) return null;

  const newChildren: TreeNode[] = [];
  for (const child of node.children ?? []) {
    const pruned = pruneTreeForLLM(child);
    if (pruned) newChildren.push(pruned);
  }
  // Drop empty directories, except the root (which has empty path).
  if (newChildren.length === 0 && node.path !== "") return null;
  return { ...node, children: newChildren };
}

/**
 * Render a single file as a Markdown section. Returns "" to signal the file
 * should be skipped (binary, empty, minified, or filtered by name).
 *
 * Format: `## <path>` followed by a fenced code block tagged `<lang>:<path>`
 * (Cursor-style annotation). If the language is unknown, only the path is
 * embedded. Files larger than MAX_FILE_BYTES are truncated with a note.
 */
export function processFile(file: FileItem): string {
  if (!shouldIncludeByName(file.path, file.name)) return "";

  const raw = file.content ?? "";
  if (raw.length === 0) return "";
  if (raw.trim().length === 0) return "";
  if (isBinaryContent(raw)) return "";
  if (isLikelyMinified(raw)) return "";

  let body = raw;
  let truncationNote = "";
  if (raw.length > MAX_FILE_BYTES) {
    body = raw.slice(0, MAX_FILE_BYTES);
    truncationNote = `\n\n_[truncated: showing first ${MAX_FILE_BYTES.toLocaleString("en-US")} of ${raw.length.toLocaleString("en-US")} bytes]_`;
  }

  const lang = detectLanguage(file.name);
  const fence = lang ? `${lang}:${file.path}` : file.path;
  return `## ${file.path}\n\`\`\`${fence}\n${body}\n\`\`\`${truncationNote}`;
}

// Create a Markdown tree structure of files
export function createTreeStructure(rootNode: TreeNode): string {
    const lines: string[] = [];

    const sortChildren = (children: TreeNode[]): TreeNode[] => {
        return [...children].sort((a, b) => {
            if (a.type === "tree" && b.type === "blob") return -1; // Directories first
            if (a.type === "blob" && b.type === "tree") return 1;  // Then files
            return a.name.localeCompare(b.name); // Then alphabetically
        });
    };

    function buildTreeLines(currentNode: TreeNode, indentPrefix: string, isLastInParent: boolean) {
        let line = indentPrefix;
        if (indentPrefix.length > 0 || currentNode.path !== "") { // Add connector for non-root items or if indentPrefix suggests it's not the absolute root
            line += isLastInParent ? "└── " : "├── ";
        }
        line += currentNode.name + (currentNode.type === "tree" ? "/" : "");
        lines.push(line);

        if (currentNode.type === "tree" && currentNode.children && currentNode.children.length > 0) {
            const sortedChildren = sortChildren(currentNode.children);
            sortedChildren.forEach((child, index) => {
                const newIndentPrefixBase = (currentNode.path === "") ? "" : indentPrefix;
                const connectorForChildren = (currentNode.path === "") ? "" : (isLastInParent ? "    " : "|   ");

                buildTreeLines(child, newIndentPrefixBase + connectorForChildren, index === sortedChildren.length - 1);
            });
        }
    }

    lines.push(rootNode.name + "/");

    if (rootNode.children && rootNode.children.length > 0) {
        const sortedRootChildren = sortChildren(rootNode.children);
        sortedRootChildren.forEach((child, index) => {
            buildTreeLines(child, "", index === sortedRootChildren.length - 1);
        });
    }

    return "```text\n" + lines.join("\n") + "\n```\n";
}
