#!/usr/bin/env python3
"""
multi_asset_report.py
---------------------
* Reads tickers from ticker_map.json
* Calculates:
      – 1-day, 1-month, 1-quarter, 1-year % moves
      – LAST PRICE  ➜ new column
      – Px vs 10/20/100/200-day simple MAs ➜ new columns
      – Forward P/E and forward-EPS growth  (Yahoo ⇒ Finviz fallback)
* Saves multi_asset_report.csv and prints a table.

Requires: yfinance, pandas, finvizfinance (fallback only).
"""

import json, os, warnings, functools, datetime as dt
from typing import List, Dict, Tuple

import pandas as pd
import yfinance as yf

# ─── Paths ──────────────────────────────────────────────────────
HERE   = os.path.dirname(os.path.abspath(__file__))
JFILE  = os.path.join(HERE, "ticker_map.json")

# ─── Price-series parameters ────────────────────────────────────
START_DATE        = "2024-01-01"
TRADING_DAYS_MO   = 21
TRADING_DAYS_QTR  = 63
TRADING_DAYS_YEAR = 252
ROLL_DAYS = {
    "chg_1d":  1,
    "chg_1m":  TRADING_DAYS_MO,
    "chg_1q":  TRADING_DAYS_QTR,
    "chg_1y":  TRADING_DAYS_YEAR,
}

MA_WINDOWS = [10, 20, 100, 200]      # new

INDEX_PATCH = {
    "GSPC": "^GSPC", "NDX": "^NDX",  "RUT": "^RUT",  "HSI": "^HSI",
    "STOXX50E": "^STOXX50E",         "N225": "^N225","VIX": "^VIX",
    "AXJO": "^AXJO",   # ← new
    "XJO":  "^AXJO",   # handles either spelling
    "DJI":  "^DJI"     # ← new
}

CATEGORY_ORDER = {
    "Global Markets": 1,
    "ASX Indices": 2,
    "ASX Sectors": 3,
    "Commodities": 4,
    "Forex": 5,
    "Bonds": 6,
    "Equal Weight": 7,  # This category will be renamed
    "USA Thematics": 8,
    "USA Sectors": 9
}

# ════════════════════════════════════════════════════════════════
# 0 ▸ LOAD TICKERS
# ════════════════════════════════════════════════════════════════
def load_tickers(path: str) -> Tuple[List[str], Dict[str, Dict]]:
    data = json.load(open(path, encoding="utf-8"))
    symbols, meta = [], {}
    for code, rec in data.items():
        if not rec.get("source", "").startswith(("stocks.", "crypto.")):
            continue
        sym = INDEX_PATCH.get(rec.get("symbol", ""), rec.get("symbol"))
        if sym:
            symbols.append(sym)
            meta[sym] = {"Disp": code, "Name": rec.get("co", code), "Cat": rec.get("cat", "")}
    meta = rename_categories(meta)
    return symbols, meta

def rename_categories(meta_dict):
    for sym, data in meta_dict.items():
        if data["Cat"] == "Equal Weight":
            data["Cat"] = "USA Equal Weight"
    return meta_dict

SYMBOLS, META = load_tickers(JFILE)

# ════════════════════════════════════════════════════════════════
# 1 ▸ PRICE HISTORY  (single yfinance call)
# ════════════════════════════════════════════════════════════════
def get_price_frames(symbols: List[str]) -> Dict[str, pd.Series]:
    df = yf.download(symbols, start=START_DATE, interval="1d",
                     auto_adjust=True, progress=False, group_by="ticker")
    out = {}
    for sym in symbols:
        try:
            ser = df[sym]["Close"] if isinstance(df.columns, pd.MultiIndex) else df["Close"]
            ser = ser.dropna()
            if len(ser) >= max(MA_WINDOWS)+1:
                out[sym] = ser
            else:
                print(f"[insufficient history] {sym}")
        except KeyError:
            print(f"[download failed] {sym}")
    return out

PRICE_SERIES = get_price_frames(SYMBOLS)

def pct_change_series(series: pd.Series) -> Dict[str, float]:
    last = series.iloc[-1]
    res  = {}
    for lbl, days in ROLL_DAYS.items():
        res[lbl] = (last / series.iloc[-1-days] - 1) * 100 if len(series) > days else float('nan')
    return res

def ma_distance(series: pd.Series) -> Dict[str, float]:
    """Return {Px_vs_10d, Px_vs_20d, ...} in %."""
    last = series.iloc[-1]
    out  = {}
    for w in MA_WINDOWS:
        sma = series.tail(w).mean()
        out[f"Px_vs_{w}d"] = (last / sma - 1) * 100
    return out

# ════════════════════════════════════════════════════════════════
# 2 ▸ FORWARD METRICS  (Yahoo ⇒ Finviz)
# ════════════════════════════════════════════════════════════════
@functools.lru_cache(maxsize=256)
def _from_yahoo(sym: str) -> Dict[str, float]:
    info = yf.Ticker(sym).info or {}
    trail = float(info.get("trailingEps") or 0)
    fwd   = float(info.get("forwardEps")  or 0)
    eps_g = ((fwd / trail) - 1) * 100 if trail and fwd else None
    return {"forward_PE": float(info.get("forwardPE") or 0), "EPS_growth": eps_g}

@functools.lru_cache(maxsize=256)
def _from_finviz(sym: str) -> Dict[str, float]:
    try:
        from finvizfinance.quote import finvizfinance
        q = finvizfinance(sym).ticker_fundament()
        trail = float(q.get("EPS (ttm)", "0").replace(",", "") or 0)
        fwd   = float(q.get("EPS next Y", "0").replace(",", "") or 0)
        pe    = float(q.get("Forward P/E", "0").replace(",", "") or 0)
        eps_g = ((fwd / trail) - 1) * 100 if trail and fwd else None
        return {"forward_PE": pe, "EPS_growth": eps_g}
    except Exception:
        return {"forward_PE": 0.0, "EPS_growth": None}

def forward_metrics(sym: str) -> Dict[str, float]:
    pri = _from_yahoo(sym)
    if pri["forward_PE"] and pri["EPS_growth"] is not None:
        return pri
    alt = _from_finviz(sym)
    return {"forward_PE": pri["forward_PE"] or alt["forward_PE"],
            "EPS_growth": pri["EPS_growth"] if pri["EPS_growth"] is not None else alt["EPS_growth"]}

# ════════════════════════════════════════════════════════════════
# 3 ▸ ASSEMBLE & OUTPUT
# ════════════════════════════════════════════════════════════════
def main() -> None:
    warnings.filterwarnings("ignore", category=FutureWarning)
    rows = []

    for sym in SYMBOLS:
        series = PRICE_SERIES.get(sym)
        if series is None:
            print(f"[skip] {sym} — no usable prices")
            continue

        last_px = series.iloc[-1]
        row = {
            **META[sym],
            "Last_Price": last_px,                 # ← NEW
            **pct_change_series(series),
            **forward_metrics(sym),
            **ma_distance(series)                  # ← NEW
        }
        rows.append(row)

    if not rows:
        print("Nothing to report.")
        return

    # Create DataFrame and add category order
    df = pd.DataFrame(rows).set_index("Disp")
    
    # Add Cat_Order column for sorting
    df['Cat_Order'] = df['Cat'].map(CATEGORY_ORDER)
    
    # Sort and format
    df = (df
          .sort_values(['Cat_Order', 'Cat', 'chg_1d'], 
                      ascending=[True, True, False])
          .round(2))
    
    # Drop the helper column
    df = df.drop('Cat_Order', axis=1)

    # Insert blank rows between categories
    df_spaces, current = [], None
    for _, r in df.iterrows():
        if current and r['Cat'] != current:
            df_spaces.append(pd.Series(dtype=float, name=''))  # blank row
        df_spaces.append(r)
        current = r['Cat']
    df = pd.DataFrame(df_spaces)

    # format % columns for console
    pct_cols = [c for c in df.columns if c.startswith("chg_") or c.startswith("Px_vs_")]
    for col in pct_cols + ["EPS_growth"]:
        df[col] = df[col].map(lambda x: f"{x:.1f}%" if pd.notna(x) else "–")

    print(f"\nMulti-Asset Metrics ({len(df) - df.index.isin(['']).sum()} tickers, {dt.date.today()})\n")
    print(df.to_string())

    # save raw numeric values in same folder as script
    output_path = os.path.join(HERE, "Morning_Dashboard_Output.csv")
    df_raw = df.replace('–', pd.NA)
    df_raw.to_csv(output_path, index=True)
    print(f"\nSaved → {output_path}")

if __name__ == "__main__":
    main()
