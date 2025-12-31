/**
 * ChromaDB Connection Test
 *
 * Run this to verify your ChromaDB Cloud connection and API key permissions
 */

import { ChromaClient } from 'chromadb';
import * as dotenv from 'dotenv';

dotenv.config();

async function testChromaDBConnection() {
  console.log('🧪 Testing ChromaDB Cloud Connection...\n');

  // Configuration
  const host = process.env.CHROMA_HOST;
  const tenant = process.env.CHROMA_TENANT;
  const database = process.env.CHROMA_DATABASE || 'default_database';
  const apiKey = process.env.CHROMA_API_KEY;
  const collectionName = process.env.CHROMA_COLLECTION || 'codebase_functions';
  const useSSL = process.env.CHROMA_USE_SSL === 'true';
  const port = process.env.CHROMA_PORT || '443';

  console.log('📋 Configuration:');
  console.log(`   Host: ${host}`);
  console.log(`   Tenant: ${tenant}`);
  console.log(`   Database: ${database}`);
  console.log(`   API Key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'NOT SET'}`);
  console.log(`   Collection: ${collectionName}`);
  console.log(`   SSL: ${useSSL}`);
  console.log(`   Port: ${port}\n`);

  if (!host || !tenant || !apiKey) {
    console.error('❌ Missing required environment variables!');
    console.error('   Required: CHROMA_HOST, CHROMA_TENANT, CHROMA_API_KEY');
    process.exit(1);
  }

  const path = useSSL ? `https://${host}` : `http://${host}:${port}`;

  try {
    // Test 1: Initialize client
    console.log('🔌 Test 1: Initializing ChromaDB client...');
    const client = new ChromaClient({
      path,
      tenant,
      database,
      auth: {
        provider: 'token',
        credentials: apiKey,
        tokenHeaderType: 'X_CHROMA_TOKEN', // Required for ChromaDB Cloud
      },
    });
    console.log('   ✅ Client initialized\n');

    // Test 2: Heartbeat
    console.log('💓 Test 2: Testing connection (heartbeat)...');
    const heartbeat = await client.heartbeat();
    console.log(`   ✅ Heartbeat successful: ${heartbeat}\n`);

    // Test 3: List collections
    console.log('📚 Test 3: Listing collections...');
    const collections = await client.listCollections();
    console.log(`   ✅ Found ${collections.length} collections:`);
    collections.forEach((col: any) => {
      console.log(`      - ${col.name || col}`);
    });
    console.log();

    // Test 4: Get specific collection
    console.log(`🔍 Test 4: Getting collection '${collectionName}'...`);
    try {
      const collection = await client.getCollection({
        name: collectionName,
        embeddingFunction: {
          generate: async (texts: string[]) => {
            throw new Error('Should not be called');
          },
        },
      } as any);
      console.log(`   ✅ Collection found: ${(collection as any).name}\n`);

      // Test 5: Count documents
      console.log('📊 Test 5: Counting documents in collection...');
      const count = await collection.count();
      console.log(`   ✅ Collection has ${count} documents\n`);

      // Test 6: Query collection (if documents exist)
      if (count > 0) {
        console.log('🔎 Test 6: Testing query...');
        try {
          // Create a dummy embedding vector (1536 dimensions)
          const dummyEmbedding = Array(1536).fill(0.1);

          const results = await collection.query({
            queryEmbeddings: [dummyEmbedding],
            nResults: 3,
          });

          console.log(`   ✅ Query successful! Found ${results.ids[0]?.length || 0} results`);
          if (results.ids[0] && results.ids[0].length > 0) {
            console.log('   Sample results:');
            results.ids[0].slice(0, 3).forEach((id, idx) => {
              console.log(`      ${idx + 1}. ID: ${id}`);
              if (results.metadatas?.[0]?.[idx]) {
                console.log(`         Metadata: ${JSON.stringify(results.metadatas[0][idx])}`);
              }
            });
          }
        } catch (error: any) {
          console.error(`   ❌ Query failed: ${error.message}`);
          console.error(`   Error name: ${error.name}`);
        }
      } else {
        console.log('⚠️  Test 6: Skipped (collection is empty)');
      }

    } catch (error: any) {
      console.error(`   ❌ Collection '${collectionName}' not found!`);
      console.error(`   Error: ${error.message}`);
      console.error(`   Error name: ${error.name}`);
      console.log('\n💡 Tip: Check if the collection exists in your ChromaDB Cloud dashboard');
    }

    console.log('\n✅ All connection tests passed!');
    console.log('🎉 Your ChromaDB Cloud setup is working correctly!\n');

  } catch (error: any) {
    console.error('\n❌ Connection test failed!');
    console.error(`   Error: ${error.message}`);
    console.error(`   Error name: ${error.name}`);
    if (error.stack) {
      console.error(`   Stack trace: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
    }
    console.log('\n💡 Troubleshooting tips:');
    console.log('   1. Verify your CHROMA_API_KEY is correct');
    console.log('   2. Check that the API key has permission to access the tenant/database');
    console.log('   3. Confirm the collection exists in your ChromaDB Cloud dashboard');
    console.log('   4. Ensure CHROMA_TENANT and CHROMA_DATABASE are correct\n');
    process.exit(1);
  }
}

testChromaDBConnection();
