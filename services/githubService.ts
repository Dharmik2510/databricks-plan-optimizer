import { RepoConfig, RepoFile } from "../types";

// Helper to parse GitHub URL
const parseGithubUrl = (url: string) => {
  try {
    const cleanUrl = url.replace(/\.git$/, "");
    const parts = cleanUrl.split("/");
    const owner = parts[parts.length - 2];
    const repo = parts[parts.length - 1];
    return { owner, repo };
  } catch (e) {
    throw new Error("Invalid GitHub URL");
  }
};

export const fetchRepoContents = async (config: RepoConfig): Promise<RepoFile[]> => {
  const { owner, repo } = parseGithubUrl(config.url);
  const headers: HeadersInit = {
    "Accept": "application/vnd.github.v3+json",
  };

  if (config.token) {
    headers["Authorization"] = `token ${config.token}`;
  }

  // 1. Get the Tree (Recursive)
  // Limit to 1 recursive level for demo performance, or specific depth
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${config.branch}?recursive=1`;
  
  const treeRes = await fetch(treeUrl, { headers });
  if (!treeRes.ok) {
    throw new Error(`Failed to fetch repo tree: ${treeRes.statusText}`);
  }

  const treeData = await treeRes.json();
  
  // 2. Filter for relevant data files (PySpark, Scala, SQL)
  // We limit to top 10 files to prevent context overflow in Gemini for this demo
  const relevantFiles = treeData.tree
    .filter((node: any) => 
      node.type === "blob" && 
      (node.path.endsWith(".py") || node.path.endsWith(".scala") || node.path.endsWith(".sql"))
    )
    .slice(0, 10); // Hard limit for demo

  // 3. Fetch content for each file
  const filePromises = relevantFiles.map(async (node: any) => {
    const contentUrl = node.url; // Git blob URL
    const res = await fetch(contentUrl, { headers });
    const data = await res.json();
    // Content is base64 encoded
    const content = atob(data.content);
    return {
      path: node.path,
      content: content
    };
  });

  return Promise.all(filePromises);
};