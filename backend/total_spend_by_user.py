"""
PySpark script to calculate total spend by user.

This script replicates the following physical plan:
- Reads transactions from Parquet (s3://bucket/data/transactions)
- Reads users from CSV (s3://bucket/data/users)
- Filters transactions where transaction_date >= '2023-01-01'
- Filters users where status = 'active'
- Joins the two datasets on user_id
- Aggregates to calculate total spend per user

WARNING: The original plan shows a BroadcastNestedLoopJoin with missing join condition
(Cartesian Product). This script fixes that by adding the proper join condition.
"""

from pyspark.sql import SparkSession
from pyspark.sql.functions import sum as spark_sum, col


def create_spark_session():
    """Create and configure SparkSession."""
    return (
        SparkSession.builder
        .appName("TotalSpendByUser")
        .config("spark.sql.adaptive.enabled", "true")
        .config("spark.sql.shuffle.partitions", "200")
        .getOrCreate()
    )


def read_transactions(spark, path="s3://bucket/data/transactions"):
    """
    Read transactions from Parquet.
    
    Schema: user_id (string), transaction_date (date), amount (double)
    Expected: ~15M rows, ~1.2GB
    """
    return (
        spark.read
        .parquet(path)
        .select("user_id", "transaction_date", "amount")
    )


def read_users(spark, path="s3://bucket/data/users"):
    """
    Read users from CSV.
    
    Schema: user_id (string), status (string)
    Expected: ~500K rows, ~25MB
    """
    return (
        spark.read
        .option("header", "true")
        .option("inferSchema", "true")
        .csv(path)
        .select("user_id", "status")
    )


def calculate_total_spend_by_user(transactions_df, users_df):
    """
    Calculate total spend per active user for transactions from 2023 onwards.
    
    Steps:
    1. Filter transactions where transaction_date >= '2023-01-01'
    2. Filter users where status = 'active'
    3. Join on user_id (broadcast the smaller users table)
    4. Aggregate sum of amount by user_id
    """
    # Filter transactions: transaction_date >= '2023-01-01' and not null
    filtered_transactions = (
        transactions_df
        .filter(col("transaction_date").isNotNull())
        .filter(col("transaction_date") >= "2023-01-01")
        .select("user_id", "amount")
    )
    
    # Filter users: status = 'active' and user_id is not null
    active_users = (
        users_df
        .filter(col("status") == "active")
        .filter(col("user_id").isNotNull())
        .select("user_id")
    )
    
    # Join transactions with active users
    # Using broadcast hint for the smaller users table (~45MB after filter)
    from pyspark.sql.functions import broadcast
    
    joined_df = (
        filtered_transactions
        .join(
            broadcast(active_users),
            filtered_transactions["user_id"] == active_users["user_id"],
            "inner"
        )
        .select(filtered_transactions["user_id"], "amount")
    )
    
    # Aggregate: sum amount by user_id
    result_df = (
        joined_df
        .groupBy("user_id")
        .agg(spark_sum("amount").alias("total_spend"))
        .orderBy("user_id")
    )
    
    return result_df


def main():
    """Main entry point."""
    spark = create_spark_session()
    
    try:
        # Read source data
        transactions_df = read_transactions(spark)
        users_df = read_users(spark)
        
        # Calculate total spend by user
        result_df = calculate_total_spend_by_user(transactions_df, users_df)
        
        # Show results (for debugging/verification)
        result_df.show(20, truncate=False)
        
        # Optionally write results
        # result_df.write.mode("overwrite").parquet("s3://bucket/output/total_spend_by_user")
        
        # Print execution plan for verification
        print("\n=== Physical Plan ===")
        result_df.explain(mode="extended")
        
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
