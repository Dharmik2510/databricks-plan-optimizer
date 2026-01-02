feat: Advanced multi-pass execution plan analyzer with quantified optimization

🚀 Major Features Added:

## 1. Multi-Pass Analysis Pipeline (Revolutionary)
- Pass 1: Structural decomposition with cardinality tracking
- Pass 2: Quantified bottleneck detection (time + cost calculations)
- Pass 3: Adaptive optimization with multiple solution strategies
- Pass 4: Configuration recommendations and architectural refactoring

## 2. Quantified Impact Metrics (Industry First)
- estimated_time_saved_seconds: Precise performance impact
- estimated_cost_saved_usd: Dollar savings per execution
- confidence_score: AI certainty rating (0-100)
- implementation_complexity: Effort assessment (Low/Medium/High)
- affected_stages: Surgical precision on problem locations

## 3. Query Health Scoring System
- query_complexity_score: 0-100 execution plan health rating
- optimization_impact_score: Potential improvement percentage
- risk_assessment: Matrix for OOM, skew, shuffle overhead risks

## 4. Enhanced UI Components
- Impact summary cards with total savings projection
- Metric badges showing time/cost/complexity for each optimization
- Risk assessment dashboard with color-coded indicators
- Complexity score visualization with health gauges

## 5. Advanced Anti-Pattern Detection
Implemented 10+ detection algorithms:
- Cartesian products (BroadcastNestedLoopJoin) with O(n*m) impact
- Shuffle explosions with network saturation analysis
- Missing partition filters with pruning cost calculation
- Broadcast size violations with threshold checking
- Sort-before-shuffle redundancy detection
- Data skew identification with straggler analysis
- Inefficient file formats (CSV/JSON) penalty
- Wide transformations in loops
- Schema inference overhead (2-pass penalty)
- Missing Z-Order/clustering optimization

## 6. Multi-Strategy Solution Generation
Each optimization provides:
- Quick Fix: Minimal code change
- Recommended Fix: Best practice approach
- Architectural Fix: Long-term design improvement

## 7. Code Traceability Improvements
- Maps DAG nodes to exact source file + line number
- Traces data lineage through transformations
- Identifies root causes in application code
- Supports GitHub repository integration

## 8. Cost-Benefit Ranking
- Optimizations sorted by ROI (impact × confidence)
- Total savings with frequency modeling (daily/yearly)
- Implementation effort vs. impact trade-off analysis

## 9. Enhanced Demo Data
- Realistic execution plan with statistics
- Multiple anti-patterns for comprehensive demonstration
- Quantified metrics (847s execution, $12.40 cost)
- Partitioning and file format issues

📊 What Makes This Unique:

| Feature | BrickOptima | Others |
|---------|-------------|--------|
| Quantified Time Savings | ✅ | ❌ |
| Cost Impact Per Run | ✅ | ❌ |
| Confidence Scoring | ✅ | ❌ |
| Multi-Strategy Solutions | ✅ | ❌ |
| Risk Assessment Matrix | ✅ | ❌ |
| Query Complexity Score | ✅ | ❌ |

🛠️ Technical Improvements:

- Enhanced TypeScript interfaces with new metric fields
- Updated Gemini service with comprehensive system instructions
- Improved JSON schema validation for structured outputs
- Better error handling and validation
- Responsive UI with Tailwind glass morphism design
- Optimized D3.js force simulation parameters

🎯 Business Impact:

- Enables data teams to quantify optimization ROI before implementation
- Reduces guesswork with confidence-scored recommendations
- Accelerates troubleshooting with precise problem localization
- Lowers cloud costs through data-driven optimization prioritization

📝 Breaking Changes:

- OptimizationTip interface extended with new fields
- AnalysisResult interface includes query_complexity_score and risk_assessment
- Component props updated to handle new metrics

✅ Testing:

- Verified with realistic Spark execution plans
- Tested GitHub repository integration
- Validated cost calculation formulas
- UI tested across desktop and mobile viewports

🔗 Related Issues: #1, #2, #3