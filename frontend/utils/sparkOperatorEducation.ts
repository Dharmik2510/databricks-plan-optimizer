
/**
 * Spark Operator Education Content
 * 
 * Provides educational context and external documentation links for 
 * standard Spark physical plan operators.
 */

interface OperatorEducation {
    explanation: string;
    learnMoreUrl: string;
}

const DEFAULT_EDUCATION: OperatorEducation = {
    explanation: "This is a physical plan operator in Spark's execution engine. It represents a specific step in processing your data distributed across the cluster.",
    learnMoreUrl: "https://spark.apache.org/docs/latest/sql-ref-syntax-qry-explain.html"
};

const SPARK_OPERATOR_EDUCATION: Record<string, OperatorEducation> = {
    'Exchange': {
        explanation: "Redistributes data across partitions to ensure that all data required for a subsequent operation (like a Join or Aggregate) resides on the same executor. This involves a physical data shuffle over the network.",
        learnMoreUrl: "https://spark.apache.org/docs/latest/sql-performance-tuning.html"
    },
    'BroadcastExchange': {
        explanation: "Collects the results of a smaller child method and broadcasts them to all executors. This avoids a full shuffle of the larger table during joins.",
        learnMoreUrl: "https://spark.apache.org/docs/latest/sql-performance-tuning.html#broadcast-hint-for-sql-queries"
    },
    'HashAggregate': {
        explanation: "Performs aggregation (SUM, AVG, COUNT, etc.) using a hash map. It typically operates in two phases: partial aggregation on each mapper, followed by final aggregation on the reducer.",
        learnMoreUrl: "https://docs.databricks.com/optimizations/higher-order.html"
    },
    'SortAggregate': {
        explanation: "Aggregates data by first sorting it. This is often used when there is not enough memory for a HashAggregate or when the data is already sorted.",
        learnMoreUrl: "https://spark.apache.org/docs/latest/sql-performance-tuning.html"
    },
    'BroadcastHashJoin': {
        explanation: "A specific join strategy where the smaller side of the join is broadcasted to all executors. This is generally the fastest join type as it avoids shuffling the large table.",
        learnMoreUrl: "https://spark.apache.org/docs/latest/sql-performance-tuning.html#broadcast-hint-for-sql-queries"
    },
    'SortMergeJoin': {
        explanation: "A robust join strategy for large tables. Both sides are sorted on the join key, and then merged. It requires a shuffle unless the data is bucketed or already partitioned.",
        learnMoreUrl: "https://www.databricks.com/blog/2021/10/26/optimizing-spark-sql-joins.html"
    },
    'BroadcastNestedLoopJoin': {
        explanation: "A join strategy often used for non-equi joins or when no other join type applies. It broadcasts one side and loops over it for every row in the other side. This can be very expensive (O(M*N)).",
        learnMoreUrl: "https://spark.apache.org/docs/latest/sql-performance-tuning.html"
    },
    'Filter': {
        explanation: "Filters rows based on a condition (predicate). Spark tries to push these updates as close to the data source as possible (Predicate Pushdown) to minimize data reading.",
        learnMoreUrl: "https://spark.apache.org/docs/latest/sql-performance-tuning.html"
    },
    'Project': {
        explanation: "Selects a subset of columns or applies transformations to columns. This is equivalent to a SELECT statement in SQL.",
        learnMoreUrl: "https://spark.apache.org/docs/latest/sql-ref.html"
    },
    'Scan': {
        explanation: "Reads data from a source (Parquet, Delta, CSV, JDBC, etc.). Efficient scans utilize partition pruning and column pruning to read only necessary data.",
        learnMoreUrl: "https://spark.apache.org/docs/latest/sql-data-sources.html"
    },
    'FileScan': {
        explanation: "Reads files from a file system (e.g., HDFS, S3). It supports various optimizations like partition discovery and filter pushdown.",
        learnMoreUrl: "https://spark.apache.org/docs/latest/sql-data-sources-parquet.html"
    },
    'Photon': {
        explanation: "Indicates that this part of the plan is running on the Photon engine, Databricks' vectorized native execution engine written in C++.",
        learnMoreUrl: "https://docs.databricks.com/runtime/photon.html"
    },
    'AQE Shuffle Read': {
        explanation: "A shuffle read operation optimized by Adaptive Query Execution (AQE). It may have coalesced small partitions or handled skewed data automatically.",
        learnMoreUrl: "https://spark.apache.org/docs/latest/sql-performance-tuning.html#adaptive-query-execution"
    }
};

/**
 * matches an operator type string to the best available education content.
 * Handles partial matches (e.g. "Scan parquet" -> "Scan")
 */
export function getOperatorEducation(operatorType: string | null): OperatorEducation {
    if (!operatorType) return DEFAULT_EDUCATION;

    const normalizedType = operatorType.trim();

    // Direct match
    if (SPARK_OPERATOR_EDUCATION[normalizedType]) {
        return SPARK_OPERATOR_EDUCATION[normalizedType];
    }

    // Partial match keys
    const keys = Object.keys(SPARK_OPERATOR_EDUCATION);
    for (const key of keys) {
        if (normalizedType.includes(key)) {
            return SPARK_OPERATOR_EDUCATION[key];
        }
    }

    return DEFAULT_EDUCATION;
}
