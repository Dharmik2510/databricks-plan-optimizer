# Cost Estimation & Pricing

## Feature Overview

Real-time cloud instance pricing integration with AWS, Azure, and GCP to provide accurate cost calculations for Databricks clusters, including compute costs, DBU pricing, and optimization savings projections.

---

## Technical Architecture

### Frontend Components

#### 1. **CostEstimator Component**
- **Location:** [frontend/CostEstimator.tsx](../frontend/CostEstimator.tsx)
- **Purpose:** Interactive cost calculator and instance selector
- **Features:**
  - Cloud provider selector (AWS, Azure, GCP)
  - Region selector (dynamic based on provider)
  - Instance type dropdown with pricing
  - Workload type selector (Jobs, All-Purpose, SQL)
  - Cluster size configuration (nodes, hours)
  - Cost breakdown display
  - Savings projection based on optimizations

**UI Layout:**
```
┌─────────────────────────────────────────────┐
│ Cost Estimation                             │
├─────────────────────────────────────────────┤
│ Cloud Provider:  [AWS ▼] [Azure] [GCP]     │
│ Region:          [us-east-1 ▼]             │
│ Instance Type:   [m5.2xlarge - $0.384/hr ▼]│
│ Workload Type:   [Jobs Compute ▼]          │
│                                             │
│ Cluster Configuration:                      │
│   Worker Nodes:  [8 ▼]                     │
│   Runtime (hrs): [24 ▼]                    │
│                                             │
├─────────────────────────────────────────────┤
│ Cost Breakdown                              │
│                                             │
│   Compute Cost:      $73.73                │
│   DBU Cost:          $29.49                │
│   ─────────────────────────                │
│   Total:            $103.22                │
│                                             │
│   Potential Savings: $45.20 (43.8%)        │
│   (Based on 5 optimizations)               │
└─────────────────────────────────────────────┘
```

#### 2. **Cost Calculation Logic**
```typescript
// Frontend calculation
function calculateTotalCost(
  instancePrice: number,
  dbuPrice: number,
  nodeCount: number,
  hours: number
): CostBreakdown {
  const computeCost = instancePrice * nodeCount * hours;
  const dbuCost = dbuPrice * nodeCount * hours;
  const totalCost = computeCost + dbuCost;

  return {
    computeCost,
    dbuCost,
    totalCost
  };
}
```

### Backend Modules

#### 1. **PricingController**
- **Location:** [backend/src/modules/pricing/pricing.controller.ts](../backend/src/modules/pricing/pricing.controller.ts)

**Endpoints:**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/pricing/instances?cloud={provider}&region={region}` | Get instance pricing | Yes |
| GET | `/api/v1/pricing/regions?cloud={provider}` | List available regions | Yes |

**Query Parameters:**
```typescript
// GET /api/v1/pricing/instances
{
  cloud: 'aws' | 'azure' | 'gcp';
  region: string;  // e.g., 'us-east-1'
  family?: string; // Optional filter: 'compute-optimized', 'memory-optimized'
}
```

**Response:**
```typescript
{
  instances: [
    {
      name: 'm5.2xlarge',
      vCPUs: 8,
      memory: 32,           // GB
      pricePerHour: 0.384,  // Compute cost
      dbuPricePerHour: 0.15, // DBU cost (Jobs)
      totalPricePerHour: 0.534,
      family: 'general-purpose',
      cloud: 'aws',
      region: 'us-east-1'
    },
    // ... more instances
  ],
  cachedAt: '2024-01-15T10:30:00Z',
  expiresAt: '2024-01-16T10:30:00Z'
}
```

#### 2. **PricingService**
- **Location:** [backend/src/modules/pricing/pricing.service.ts](../backend/src/modules/pricing/pricing.service.ts)
- **Purpose:** Fetch and cache cloud pricing data

**Key Methods:**

**`getInstances(cloud, region, family?)`**
```typescript
async getInstances(
  cloud: CloudProvider,
  region: string,
  family?: string
): Promise<InstancePricing[]> {
  // 1. Check cache
  const cacheKey = `${cloud}-${region}`;
  const cached = await this.getFromCache(cacheKey);

  if (cached && !this.isCacheExpired(cached)) {
    return this.filterByFamily(cached.instances, family);
  }

  // 2. Fetch from cloud provider API
  let instances: InstancePricing[];

  switch (cloud) {
    case 'aws':
      instances = await this.fetchAWSPricing(region);
      break;
    case 'azure':
      instances = await this.fetchAzurePricing(region);
      break;
    case 'gcp':
      instances = await this.fetchGCPPricing(region);
      break;
  }

  // 3. Add DBU pricing
  instances = instances.map(inst => ({
    ...inst,
    dbuPricePerHour: this.getDBUPrice(inst, 'JOBS'),
    totalPricePerHour: inst.pricePerHour + this.getDBUPrice(inst, 'JOBS')
  }));

  // 4. Cache for 24 hours
  await this.saveToCache(cacheKey, instances, 24 * 3600);

  return this.filterByFamily(instances, family);
}
```

**`getRegions(cloud)`**
```typescript
async getRegions(cloud: CloudProvider): Promise<Region[]> {
  const regionMap = {
    aws: [
      { code: 'us-east-1', name: 'US East (N. Virginia)', multiplier: 1.0 },
      { code: 'us-west-2', name: 'US West (Oregon)', multiplier: 1.0 },
      { code: 'eu-west-1', name: 'EU (Ireland)', multiplier: 1.1 },
      { code: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', multiplier: 1.15 }
    ],
    azure: [
      { code: 'eastus', name: 'East US', multiplier: 1.0 },
      { code: 'westus2', name: 'West US 2', multiplier: 1.0 },
      { code: 'westeurope', name: 'West Europe', multiplier: 1.05 }
    ],
    gcp: [
      { code: 'us-central1', name: 'Iowa', multiplier: 1.0 },
      { code: 'us-west1', name: 'Oregon', multiplier: 1.0 },
      { code: 'europe-west1', name: 'Belgium', multiplier: 1.08 }
    ]
  };

  return regionMap[cloud] || [];
}
```

#### 3. **Cloud Provider Integrations**

### AWS Pricing (via runs-on.com API)

**Endpoint:** `https://runs-on.com/api/v1/instances`

**Implementation:**
```typescript
async fetchAWSPricing(region: string): Promise<InstancePricing[]> {
  const response = await axios.get('https://runs-on.com/api/v1/instances', {
    params: {
      cloud: 'aws',
      region,
      os: 'linux'
    }
  });

  return response.data.map(instance => ({
    name: instance.type,           // e.g., 'm5.2xlarge'
    vCPUs: instance.vcpus,
    memory: instance.memory_gb,
    pricePerHour: instance.price_per_hour,
    family: this.determineFamily(instance.type),
    cloud: 'aws',
    region
  }));
}
```

**Family Detection:**
```typescript
function determineFamily(instanceType: string): string {
  const prefix = instanceType.split('.')[0];

  const familyMap = {
    'm5': 'general-purpose',
    'm6': 'general-purpose',
    'c5': 'compute-optimized',
    'c6': 'compute-optimized',
    'r5': 'memory-optimized',
    'r6': 'memory-optimized',
    'i3': 'storage-optimized',
    'g4': 'gpu'
  };

  return familyMap[prefix] || 'general-purpose';
}
```

### Azure Pricing (via Azure Retail Prices API)

**Endpoint:** `https://prices.azure.com/api/retail/prices`

**Implementation:**
```typescript
async fetchAzurePricing(region: string): Promise<InstancePricing[]> {
  const response = await axios.get('https://prices.azure.com/api/retail/prices', {
    params: {
      $filter: `serviceName eq 'Virtual Machines' and armRegionName eq '${region}' and priceType eq 'Consumption'`
    }
  });

  return response.data.Items
    .filter(item => item.productName.includes('Linux'))
    .map(item => ({
      name: this.parseAzureVMSize(item.armSkuName),
      vCPUs: this.extractCPUs(item.productName),
      memory: this.extractMemory(item.productName),
      pricePerHour: item.retailPrice,
      family: this.determineAzureFamily(item.armSkuName),
      cloud: 'azure',
      region
    }));
}
```

### GCP Pricing (Static Data)

**Note:** GCP Cloud Billing API requires OAuth authentication, so using static pricing data

**Implementation:**
```typescript
async fetchGCPPricing(region: string): Promise<InstancePricing[]> {
  // Static pricing data (updated quarterly)
  const gcpPricing = {
    'n1-standard-4': { vcpus: 4, memory: 15, price: 0.19 },
    'n1-standard-8': { vcpus: 8, memory: 30, price: 0.38 },
    'n2-standard-4': { vcpus: 4, memory: 16, price: 0.21 },
    'c2-standard-4': { vcpus: 4, memory: 16, price: 0.25 }
  };

  // Apply regional multiplier
  const regionMultiplier = this.getGCPRegionMultiplier(region);

  return Object.entries(gcpPricing).map(([name, spec]) => ({
    name,
    vCPUs: spec.vcpus,
    memory: spec.memory,
    pricePerHour: spec.price * regionMultiplier,
    family: this.determineGCPFamily(name),
    cloud: 'gcp',
    region
  }));
}
```

#### 4. **DBU Pricing Logic**

**DBU (Databricks Unit):** Normalized measure of processing capability

**Pricing Tiers (per DBU-hour):**
```typescript
const DBU_PRICING = {
  JOBS: 0.15,              // Jobs Compute
  ALL_PURPOSE: 0.55,       // All-Purpose Compute
  SQL: 0.22,               // SQL Compute
  SERVERLESS: 0.70         // Serverless Compute
};
```

**DBU Calculation:**
```typescript
function getDBUPrice(
  instance: InstancePricing,
  workloadType: WorkloadType
): number {
  // DBU rate varies by instance size
  const dbuRate = this.calculateDBURate(instance.vCPUs, instance.memory);

  // Get price per DBU for workload type
  const pricePerDBU = DBU_PRICING[workloadType];

  return dbuRate * pricePerDBU;
}

function calculateDBURate(vCPUs: number, memoryGB: number): number {
  // Simplified DBU calculation
  // Actual formula: based on vCPUs, memory, and instance generation
  return Math.max(1, vCPUs / 4);
}
```

**Example:**
```
Instance: m5.2xlarge (8 vCPUs, 32 GB)
Workload: Jobs Compute

DBU Rate: 8 / 4 = 2 DBU/hour
DBU Price: 2 * $0.15 = $0.30/hour

Compute Cost: $0.384/hour
DBU Cost: $0.30/hour
Total: $0.684/hour
```

---

## Data Flow

### Pricing Data Fetch Flow

```
┌─────────────────────────────────┐
│ Frontend: CostEstimator         │
│ - User selects AWS              │
│ - User selects us-east-1        │
└───────────┬─────────────────────┘
            │
            │ 1. Request instances
            ▼
┌─────────────────────────────────┐
│ GET /api/v1/pricing/instances?  │
│     cloud=aws&region=us-east-1  │
└───────────┬─────────────────────┘
            │
            │ 2. Check cache
            ▼
┌─────────────────────────────────┐
│ PricingService.getInstances()   │
│ - Query PricingCache table      │
│ - Key: "aws-us-east-1"          │
└───────────┬─────────────────────┘
            │
            ├─ Cache Hit ──▶ Return cached data
            │
            └─ Cache Miss
                │
                │ 3. Fetch from API
                ▼
┌─────────────────────────────────┐
│ PricingService.fetchAWSPricing()│
│ - Call runs-on.com API          │
│ - Parse response                │
└───────────┬─────────────────────┘
            │
            │ 4. API response
            ▼
┌─────────────────────────────────┐
│ runs-on.com API Response:       │
│ [                               │
│   {                             │
│     type: 'm5.2xlarge',         │
│     vcpus: 8,                   │
│     memory_gb: 32,              │
│     price_per_hour: 0.384       │
│   },                            │
│   // ... more instances         │
│ ]                               │
└───────────┬─────────────────────┘
            │
            │ 5. Enrich with DBU pricing
            ▼
┌─────────────────────────────────┐
│ PricingService (continued)      │
│ - For each instance:            │
│   * Calculate DBU rate          │
│   * Add DBU price               │
│   * Calculate total price       │
│   * Determine instance family   │
└───────────┬─────────────────────┘
            │
            │ 6. Cache for 24 hours
            ▼
┌─────────────────────────────────┐
│ PostgreSQL: PricingCache table  │
│ INSERT {                        │
│   cacheKey: 'aws-us-east-1',    │
│   data: enrichedInstances,      │
│   expiresAt: now() + 24h        │
│ }                               │
└───────────┬─────────────────────┘
            │
            │ 7. Return instances
            ▼
┌─────────────────────────────────┐
│ Frontend: CostEstimator         │
│ - Populate instance dropdown    │
│ - Display prices                │
└─────────────────────────────────┘
```

---

## Database Schema

### PricingCache Table
```prisma
model PricingCache {
  id          String    @id @default(uuid())
  cacheKey    String    @unique   // e.g., 'aws-us-east-1'
  cloud       String                // 'aws', 'azure', 'gcp'
  region      String
  data        Json                  // Instance pricing array
  createdAt   DateTime  @default(now())
  expiresAt   DateTime

  @@index([cacheKey])
  @@index([expiresAt])
}
```

**Cached Data Structure:**
```json
{
  "instances": [
    {
      "name": "m5.2xlarge",
      "vCPUs": 8,
      "memory": 32,
      "pricePerHour": 0.384,
      "dbuPricePerHour": 0.15,
      "totalPricePerHour": 0.534,
      "family": "general-purpose",
      "cloud": "aws",
      "region": "us-east-1"
    }
  ],
  "cachedAt": "2024-01-15T10:30:00Z"
}
```

---

## Cost Savings Calculation

### Integration with Analysis Results

**Frontend Logic:**
```typescript
function calculatePotentialSavings(
  optimizations: Optimization[],
  currentCostPerHour: number
): SavingsEstimate {
  let totalTimeSaved = 0;
  let totalCostSaved = 0;

  optimizations.forEach(opt => {
    if (opt.impact?.timeSavedSeconds) {
      totalTimeSaved += opt.impact.timeSavedSeconds;
    }
    if (opt.impact?.costSavedUSD) {
      totalCostSaved += opt.impact.costSavedUSD;
    }
  });

  // If no direct cost savings, estimate from time savings
  if (totalCostSaved === 0 && totalTimeSaved > 0) {
    const hoursSaved = totalTimeSaved / 3600;
    totalCostSaved = hoursSaved * currentCostPerHour;
  }

  const savingsPercentage = (totalCostSaved / totalCost) * 100;

  return {
    totalTimeSaved,      // seconds
    totalCostSaved,      // USD
    savingsPercentage,
    optimizationCount: optimizations.length
  };
}
```

**Example Display:**
```
Current Monthly Cost: $7,488
(24 hours/day × 30 days × $10.40/hour)

Potential Savings: $3,270 (43.7%)
After implementing 5 optimizations:
  - Eliminate Cartesian Product: $1,200
  - Reduce Shuffle Volume: $900
  - Add Partition Pruning: $650
  - Optimize Join Strategy: $400
  - Enable Adaptive Query: $120

Optimized Monthly Cost: $4,218
```

---

## Regional Pricing Multipliers

### Why Multipliers?

Different cloud regions have different base costs due to:
- Data center operating costs
- Local electricity prices
- Regulatory requirements
- Market demand

**AWS Regional Multipliers:**
```typescript
const AWS_REGION_MULTIPLIERS = {
  'us-east-1': 1.00,      // Baseline
  'us-west-2': 1.00,
  'eu-west-1': 1.10,      // 10% higher
  'ap-southeast-1': 1.15, // 15% higher
  'sa-east-1': 1.25       // 25% higher
};
```

**Application:**
```typescript
const basePrice = 0.384; // m5.2xlarge in us-east-1
const regionMultiplier = AWS_REGION_MULTIPLIERS['eu-west-1']; // 1.10
const regionalPrice = basePrice * regionMultiplier; // $0.4224
```

---

## Performance Optimizations

### 1. Caching Strategy
- **TTL:** 24 hours
- **Rationale:** Cloud pricing changes infrequently
- **Cache Key:** `{cloud}-{region}`
- **Cache Invalidation:** Manual endpoint (admin only)

### 2. Lazy Loading
- Fetch pricing only when user selects cloud + region
- Avoid loading all clouds/regions on page load

### 3. Frontend Caching
```typescript
// Cache in component state
const [pricingCache, setPricingCache] = useState({});

const fetchPricing = async (cloud, region) => {
  const cacheKey = `${cloud}-${region}`;

  if (pricingCache[cacheKey]) {
    return pricingCache[cacheKey];
  }

  const data = await apiClient.get('/api/v1/pricing/instances', {
    params: { cloud, region }
  });

  setPricingCache(prev => ({ ...prev, [cacheKey]: data }));
  return data;
};
```

### 4. Pagination (Future)
- Return top 50 instances by default
- Allow users to load more if needed

---

## Error Handling

### Frontend Errors
- **API timeout:** Display cached pricing (if available)
- **Network error:** Retry with exponential backoff
- **No instances found:** Show message, suggest different region

### Backend Errors
- **Cloud API down:** Return cached data (even if expired)
- **Parse error:** Log error, skip malformed instances
- **Rate limiting:** Implement exponential backoff

---

## Usage Examples

### Frontend: Fetch and Display Pricing
```typescript
const CostEstimator = () => {
  const [cloud, setCloud] = useState('aws');
  const [region, setRegion] = useState('us-east-1');
  const [instances, setInstances] = useState([]);

  useEffect(() => {
    const fetchPricing = async () => {
      const data = await apiClient.get('/api/v1/pricing/instances', {
        params: { cloud, region }
      });
      setInstances(data.instances);
    };

    fetchPricing();
  }, [cloud, region]);

  return (
    <select>
      {instances.map(inst => (
        <option key={inst.name} value={inst.name}>
          {inst.name} - ${inst.totalPricePerHour.toFixed(3)}/hr
        </option>
      ))}
    </select>
  );
};
```

### Backend: Custom DBU Pricing
```typescript
// Override DBU pricing for specific customers
function getDBUPrice(
  instance: InstancePricing,
  workloadType: WorkloadType,
  userId: string
): number {
  // Check for enterprise discount
  const user = await this.userService.findById(userId);

  if (user.tier === 'enterprise') {
    return this.calculateDBURate(instance) * 0.12; // 20% discount
  }

  return this.calculateDBURate(instance) * DBU_PRICING[workloadType];
}
```

---

## Integration with Other Features

### 1. Analysis Creation
- Cluster context includes instance type and region
- Used to calculate baseline costs
- Savings estimates based on selected instance

### 2. Optimization Recommendations
- AI generates cost savings estimates
- Based on cluster configuration
- Displayed in optimization cards

### 3. Advanced Insights
- Cost projections for different cluster sizes
- What-if scenarios with different instance types

---

## Future Enhancements

- [ ] **Real-time spot pricing:** Support for AWS Spot Instances
- [ ] **Reserved instance pricing:** Discount for 1-year/3-year commitments
- [ ] **Custom pricing:** Upload custom enterprise pricing agreements
- [ ] **Cost alerts:** Notify when spending exceeds threshold
- [ ] **Budget tracking:** Monthly budget vs. actual spend
- [ ] **TCO calculator:** Total cost of ownership over time
- [ ] **Multi-region comparison:** Side-by-side region cost comparison
- [ ] **Auto-scaling cost modeling:** Cost impact of auto-scaling policies
- [ ] **Carbon footprint:** CO2 emissions per region
- [ ] **Historical pricing trends:** Track pricing changes over time
