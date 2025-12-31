import { Injectable, Logger } from '@nestjs/common';
import { ChromaClient, IEmbeddingFunction } from 'chromadb';

/**
 * Dummy embedding function for ChromaDB
 * We generate embeddings externally via OpenAI, so this is a pass-through
 */
class DummyEmbeddingFunction implements IEmbeddingFunction {
  public async generate(texts: string[]): Promise<number[][]> {
    // This should never be called since we provide embeddings directly
    throw new Error('DummyEmbeddingFunction should not be used for generation');
  }
}

@Injectable()
export class ChromaDBCloudService {
  private readonly logger = new Logger(ChromaDBCloudService.name);
  private client: ChromaClient;
  private embeddingFunction: IEmbeddingFunction;

  constructor() {
    const useSSL = process.env.CHROMA_USE_SSL === 'true';
    const port = process.env.CHROMA_PORT || '443';
    const host = process.env.CHROMA_HOST;
    const tenant = process.env.CHROMA_TENANT;
    const database = process.env.CHROMA_DATABASE || 'default_database';

    if (!host) {
      throw new Error('CHROMA_HOST environment variable is required');
    }

    if (!tenant) {
      throw new Error('CHROMA_TENANT environment variable is required for ChromaDB Cloud');
    }

    const path = useSSL ? `https://${host}` : `http://${host}:${port}`;

    this.client = new ChromaClient({
      path,
      tenant,
      database,
      auth: process.env.CHROMA_API_KEY
        ? {
          provider: 'token',
          credentials: process.env.CHROMA_API_KEY,
          tokenHeaderType: 'X_CHROMA_TOKEN', // Required for ChromaDB Cloud
        }
        : undefined,
    });

    // Initialize dummy embedding function (we provide embeddings directly)
    this.embeddingFunction = new DummyEmbeddingFunction();

    this.logger.log(`ChromaDB Cloud client initialized: ${path} (tenant: ${tenant}, database: ${database})`);
  }

  async createCollection(name: string) {
    try {
      const collection = await this.client.createCollection({
        name,
        metadata: { description: 'Code embeddings for DAG mapping' },
      });
      this.logger.log(`Collection created: ${name}`);
      return collection;
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        this.logger.log(`Collection already exists: ${name}`);
        return await this.client.getCollection({
          name,
          embeddingFunction: this.embeddingFunction,
        });
      }
      throw error;
    }
  }

  async addEmbeddings(
    collectionName: string,
    embeddings: number[][],
    metadatas: any[],
    ids: string[],
  ) {
    const collection = await this.client.getCollection({
      name: collectionName,
      embeddingFunction: this.embeddingFunction,
    });

    await collection.add({
      ids,
      embeddings,
      metadatas,
    });

    this.logger.log(`Added ${embeddings.length} embeddings to ${collectionName}`);
  }

  async query(
    collectionName: string,
    queryEmbedding: number[],
    topK: number = 10,
  ) {
    const collection = await this.client.getCollection({
      name: collectionName,
      embeddingFunction: this.embeddingFunction,
    });

    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topK,
    });

    this.logger.log(`Query returned ${results.ids[0]?.length || 0} results`);

    return results.ids[0]?.map((id, idx) => ({
      id,
      score: results.distances?.[0]?.[idx] || 0,
      metadata: results.metadatas?.[0]?.[idx] || {},
      document: results.documents?.[0]?.[idx] || '',
    })) || [];
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.heartbeat();
      return true;
    } catch (error) {
      this.logger.error('ChromaDB Cloud health check failed', error);
      return false;
    }
  }

  async deleteCollection(name: string) {
    try {
      await this.client.deleteCollection({ name });
      this.logger.log(`Collection deleted: ${name}`);
    } catch (error) {
      this.logger.error(`Failed to delete collection ${name}`, error);
      throw error;
    }
  }

  async listCollections() {
    try {
      const collections = await this.client.listCollections();
      return collections;
    } catch (error) {
      this.logger.error('Failed to list collections', error);
      throw error;
    }
  }
}
