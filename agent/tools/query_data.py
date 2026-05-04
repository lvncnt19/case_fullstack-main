import duckdb
from pydantic_ai import RunContext

from agent.context import AgentContext


async def query_data(
    ctx: RunContext[AgentContext],
    sql: str,
    description: str,
) -> str:
    """Execute a SQL query against the loaded datasets.

    Args:
        ctx: Injected context with loaded datasets.
        sql: SQL query to execute. Table names correspond to dataset names.
        description: Short description of what this query does.
    """
    if not ctx.deps.datasets:
        return "Error: No datasets loaded."

    try:
        with duckdb.connect(database=":memory:") as conn:
            for name, df in ctx.deps.datasets.items():
                conn.register(name, df)
            result_df = conn.execute(sql).fetchdf()

        ctx.deps.current_dataframe = result_df

        preview = result_df.head(5).to_string(index=False)
        summary = (
            f"Query executed successfully.\n"
            f"Result: {result_df.shape[0]} rows x {result_df.shape[1]} columns\n"
            f"Columns: {', '.join(result_df.columns.tolist())}\n"
            f"Preview:\n{preview}"
        )
        return summary

    except Exception as e:
        return f"Error executing SQL query: {e}"
