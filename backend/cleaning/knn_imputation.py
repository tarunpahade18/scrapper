import pandas as pd
import numpy as np
from typing import Dict, Any
from utils import validate_inputs, logger

PARAMETER_SCHEMA = {
    "type": "object",
    "properties": {
        "dataframeRef": {"type": "string"},
        "columns": {
            "type": "array",
            "items": {"type": "string"}
        }
    },
    "required": ["dataframeRef", "columns"]
}


def _knn_impute(values: np.ndarray, k: int) -> np.ndarray:
    result = values.astype(float, copy=True)
    n_rows = result.shape[0]
    if n_rows == 0:
        return result

    k = max(1, min(int(k), n_rows - 1)) if n_rows > 1 else 1

    for row_idx in range(n_rows):
        missing = np.isnan(result[row_idx])
        if not missing.any():
            continue
        observed = ~missing
        if not observed.any():
            continue

        distances = np.sqrt(np.nansum((values[:, observed] - result[row_idx, observed]) ** 2, axis=1))
        distances[row_idx] = np.inf
        distances[np.isnan(distances)] = np.inf

        neighbors = np.argsort(distances)[:k]
        neighbor_values = values[np.ix_(neighbors, missing)]

        with np.errstate(invalid="ignore"):
            fill_values = np.nanmean(neighbor_values, axis=0)

        fallback = np.nanmean(values[:, missing], axis=0)
        fill_values = np.where(np.isnan(fill_values), fallback, fill_values)
        result[row_idx, missing] = fill_values

    return result


def execute(inputs: Dict[str, Any], config: Dict[str, Any] = {}) -> Dict[str, Any]:
    validate_inputs(PARAMETER_SCHEMA, inputs)

    k = config.get("k", 5)

    df = pd.DataFrame()
    try:
        before = df[inputs["columns"]].isna().sum().sum()
        values = df[inputs["columns"]].to_numpy(dtype=float)
        imputed = _knn_impute(values, k)
        df[inputs["columns"]] = imputed
        after = df[inputs["columns"]].isna().sum().sum()
        new_ref = id(df)
    except Exception as e:
        logger.error(f"KNN imputation error: {str(e)}")
        new_ref = None
        before = after = 0

    return {
        "newDataframeRef": new_ref,
        "imputedCount": before - after
    }
