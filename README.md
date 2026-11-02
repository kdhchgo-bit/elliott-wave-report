# Elliott Wave Report

A repeatable workflow for turning Elliott Wave counts into an executable trade plan, delivered as a single self-contained HTML report.

Given one instrument and a few timeframes, it produces:

- wave counts at several degrees, verified against structure rules
- price targets from Fibonacci confluence (three independent calculations must overlap within 1%)
- arrival windows projected from measured wave durations
- a limit-order ladder, stops, tiered take-profits, weighted R and account-level risk
- annotated SVG charts where every level carries `price · R · date`

## Method

1. **Data** - daily/weekly/hourly OHLC from a public API (Yahoo Finance for equities and ETFs, Binance USDT-M for crypto).
2. **Degrees** - count monthly, weekly, daily, 4H, 1H and 15M, then check that each lower-degree count nests inside the higher-degree one.
3. **Correction classification** - default to a plain 5-3-5 zigzag or 3-3-5 flat. Escalate to triangle, WXY, WXYXZ, diagonal or truncation only when the simple count breaks a rule.
4. **Targets** - C = 0.618/0.786/1.0/1.272/1.618 x A, retracements of the larger move, and prior volume nodes. Keep the zones where at least three agree.
5. **Time** - measure each wave in bars, extrapolate with the same ratios, and take the overlap as a window rather than a single date.
6. **Plan** - three tranches in, stop on a closing basis, three tiers out, weighted R, and one invalidation level per thesis.

## Repository layout

```
SKILL.md                        full operating procedure (agent skill)
references/repl-lib.js          chart renderer, zigzag, trade math (paste into a REPL)
reports/SOXL_2026-10-31.html    leveraged-ETF example
reports/BTC_Elliott_2026-11-02.html  crypto example with long and short setups
```

## Instrument notes

- **Leveraged ETFs** (SOXL and similar): count on the 1x index (SOXX / ^SOX) because daily rebalancing destroys wave proportions in the ETF itself. Convert price levels with `ETF = ETF0 x (target / current)^3`.
- **Crypto**: trades 24/7, so time is measured in calendar days and the daily close is 00:00 UTC. There is no underlying index; degree separation comes from the timeframes themselves. Position sizing must respect the liquidation price, roughly `1/leverage - 0.005`.

## Verification

A report is only finished when:

- every level in the text matches the chart boxes
- the invalidation level is explicit
- the chart labels are readable at 1920 px with no overlap
- the wave path is drawn from the origin pivot through every labeled point

## Disclaimer

Research notes and study material. Not investment advice. Markets are not predictable; every setup here ships with a stop and may lose.
