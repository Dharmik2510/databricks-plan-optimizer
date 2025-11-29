
import { RepoConfig, RepoFile } from "../../shared/types";

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
    
    const relevantFiles = treeData.tree
      .filter((node: any) => {
        if (node.type !== "blob") return false;
        const hasValidExtension = fileExtensions.some(ext => node.path.endsWith(ext));
        if (!hasValidExtension) return false;
        if (!includeTests && isTestFile(node.path)) return false;
        if (shouldSkipPath(node.path)) return false;
        return true;
      })
      .sort((a: any, b: any) => getFileImportanceScore(b.path) - getFileImportanceScore(a.path))
      .slice(0, maxFiles);

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

function isTestFile(path: string): boolean {
  const testPatterns = ['/test/', '/tests/', '_test.', 'test_', '.test.'];
  return testPatterns.some(pattern => path.toLowerCase().includes(pattern));
}

function shouldSkipPath(path: string): boolean {
  const skipPatterns = ['node_modules/', '.git/', 'dist/', 'build/', '__pycache__/', 'venv/', 'env/'];
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
