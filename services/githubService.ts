
import { RepoConfig, RepoFile } from "../types";

// Helper to validate and parse GitHub URL
const parseGithubUrl = (url: string) => {
  try {
    // Validate that it's a GitHub URL
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname !== 'github.com' && !hostname.endsWith('.github.com')) {
      throw new Error("Invalid URL. Please enter a valid GitHub repository URL (e.g., https://github.com/username/repo)");
    }

    const cleanUrl = url.replace(/\.git$/, "");
    const parts = cleanUrl.split("/");
    const owner = parts[parts.length - 2];
    const repo = parts[parts.length - 1];

    if (!owner || !repo) {
      throw new Error("Invalid GitHub URL format. Expected: https://github.com/username/repo");
    }

    return { owner, repo };
  } catch (e) {
    if (e instanceof Error && e.message.includes("Invalid URL")) {
      throw e;
    }
    throw new Error("Invalid URL. Please enter a valid GitHub repository URL (e.g., https://github.com/username/repo)");
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
    const content = atob(data.content.replace(/\n/g, ''));
    return {
      path: node.path,
      content: content
    };
  });

  return Promise.all(filePromises);
};

export const fetchRepoContentsEnhanced = async (
  config: RepoConfig,
  options?: {
    maxFiles?: number;
    includeTests?: boolean;
    fileExtensions?: string[];
  }
): Promise<RepoFile[]> => {
  const { owner, repo } = parseGithubUrl(config.url);
  const maxFiles = options?.maxFiles || 50;
  const includeTests = options?.includeTests ?? false;
  const fileExtensions = options?.fileExtensions || ['.py', '.scala', '.sql', '.ipynb'];

  const headers: HeadersInit = {
    "Accept": "application/vnd.github.v3+json",
  };

  if (config.token) {
    headers["Authorization"] = `token ${config.token}`;
  }

  try {
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${config.branch}?recursive=1`;
    const treeRes = await fetch(treeUrl, { headers });
    
    if (!treeRes.ok) {
      throw new Error(`GitHub API error: ${treeRes.statusText}`);
    }

    const treeData = await treeRes.json();
    
    // Filter relevant files with smart prioritization
    const relevantFiles = treeData.tree
      .filter((node: any) => {
        if (node.type !== "blob") return false;
        
        const hasValidExtension = fileExtensions.some(ext => node.path.endsWith(ext));
        if (!hasValidExtension) return false;
        
        if (!includeTests && isTestFile(node.path)) return false;
        if (shouldSkipPath(node.path)) return false;
        
        return true;
      })
      .sort((a: any, b: any) => {
        const scoreA = getFileImportanceScore(a.path);
        const scoreB = getFileImportanceScore(b.path);
        return scoreB - scoreA;
      })
      .slice(0, maxFiles);

    // Fetch in batches to avoid rate limits
    const BATCH_SIZE = 10;
    const files: RepoFile[] = [];
    
    for (let i = 0; i < relevantFiles.length; i += BATCH_SIZE) {
      const batch = relevantFiles.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (node: any) => {
        try {
          const contentRes = await fetch(node.url, { headers });
          const data = await contentRes.json();
          return {
            path: node.path,
            content: atob(data.content.replace(/\n/g, '')),
            size: data.size,
            sha: data.sha
          };
        } catch (error) {
          console.error(`Failed to fetch ${node.path}:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      files.push(...batchResults.filter(f => f !== null) as RepoFile[]);
    }

    return files;
  } catch (error: any) {
    throw new Error(`Failed to fetch repository: ${error.message}`);
  }
};

// Helper functions
function isTestFile(path: string): boolean {
  const testPatterns = ['/test/', '/tests/', '_test.', 'test_', '.test.'];
  return testPatterns.some(pattern => path.toLowerCase().includes(pattern));
}

function shouldSkipPath(path: string): boolean {
  const skipPatterns = [
    'node_modules/', '.git/', 'dist/', 'build/', 
    '__pycache__/', 'venv/', 'env/'
  ];
  return skipPatterns.some(pattern => path.includes(pattern));
}

function getFileImportanceScore(path: string): number {
  let score = 0;
  if (path.includes('main.') || path.includes('app.')) score += 50;
  if (path.includes('job') || path.includes('pipeline')) score += 40;
  if (path.includes('etl') || path.includes('transform')) score += 30;
  if (path.includes('/src/')) score += 20;
  return score;
}
