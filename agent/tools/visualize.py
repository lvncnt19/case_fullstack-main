import os
import re
from typing import Literal

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from pydantic_ai import RunContext

from agent.context import AgentContext


async def visualize(
    ctx: RunContext[AgentContext],
    code: str,
    title: str,
    result_type: Literal["figure", "table"],
    description: str,
) -> str:
    """Create a visualization from the last query result.

    Args:
        ctx: Injected context with current DataFrame.
        code: Python code to create the visualization.
              Use `df` for the data, `px` for plotly.express,
              `go` for plotly.graph_objects, `pd` for pandas.
              Must create a `fig` variable (for figures) or `result` variable (for tables).
        title: Title of the visualization.
        result_type: Either "figure" (Plotly chart) or "table" (formatted DataFrame).
        description: Description of what this visualization shows.
    """
    if ctx.deps.current_dataframe is None:
        return "Error: No data available. Call query_data first."

    df = ctx.deps.current_dataframe

    try:
        namespace = {
            "df": df.copy(),
            "pd": pd,
            "px": px,
            "go": go,
        }
        exec(code, namespace)

        safe_title = re.sub(r"[^\w\s-]", "", title).strip().replace(" ", "_").lower()
        os.makedirs("output", exist_ok=True)

        if result_type == "figure":
            fig = namespace.get("fig")
            if fig is None:
                return "Error: Code must create a 'fig' variable (plotly Figure)."

            filepath = f"output/{safe_title}.html"
            fig.write_html(filepath)

            return (
                f"Figure created: {title}\n"
                f"Saved to: {filepath}\n"
                f"Type: {type(fig).__name__}\n"
                f"Traces: {len(fig.data)}"
            )

        elif result_type == "table":
            result = namespace.get("result", df)

            filepath = f"output/{safe_title}.csv"
            result.to_csv(filepath, index=False)

            return (
                f"Table created: {title}\n"
                f"Saved to: {filepath}\n"
                f"Shape: {result.shape[0]} rows x {result.shape[1]} columns\n"
                f"Preview:\n{result.head(10).to_string(index=False)}"
            )

        else:
            return f"Error: Unknown result_type '{result_type}'. Use 'figure' or 'table'."

    except Exception as e:
        return f"Error creating visualization: {e}"
