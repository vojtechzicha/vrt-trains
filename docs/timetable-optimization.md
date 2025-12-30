# Timetable Optimization Proposal

## Executive Summary

This document proposes timetable adjustments to fix several proklad (interval) issues across the network, while balancing competing constraints.

---

## Problems Identified

### 1. Praha → Olomouc Corridor (Outbound)
| Current | Issue |
|---------|-------|
| Ex2 :25, Ex11 :29 | Only 4 min apart |
| Ex11 :59, R18 :51 | 8 min apart |

**Target:** 15-15-15-15 pattern

### 2. Hranice → Praha (Inbound) - CRITICAL
| Current | Issue |
|---------|-------|
| Ex2 :37, R18 :37 | **SAME TIME - 0 min gap!** |

### 3. Ostrava-Svinov → Opava
| Current | Issue |
|---------|-------|
| R27/R60 :00, R28 :02 | Only 2 min apart |

**Target:** 30-30-30-30 pattern

---

## Constraints

| Constraint | Reason |
|------------|--------|
| R18 outbound at Svinov :30 | Transfer from R27/R60 arriving :00 |
| R18/R28 spacing on Ostrava-Hranice | Both serve Svinov → Studénka → Hranice |

---

## Proposed Solution

### Offsets to Apply

| Line | Direction | Offset | Notes |
|------|-----------|--------|-------|
| **Ex2** | both | **-4 min** | Praha :25→:21 |
| **Ex11** | both | **-23 min** | Praha :29/:59→:06/:36 |
| **R18** | outbound | no change | Keep Svinov :30 |
| **R18** | inbound | **+20 min** | Hranice :37→:57, Svinov :05→:25 |
| **R28** | outbound | **+13 min** | Svinov :02→:15, Hranice :30→:43 (15 min from R18) |
| **R28** | inbound | **+15 min** | Svinov :30→:45, Hranice :02→:17 |

---

## Resulting Schedules

### Praha → Olomouc (Outbound)

```
:06  Ex11  ─┐
:21  Ex2   ─┼─ 15-15-15-15 intervals ✓
:36  Ex11  ─┤
:51  R18   ─┘
```

### Ostrava → Studénka → Hranice (Inbound to Praha)

| Station | R18 | R28 | Gap |
|---------|-----|-----|-----|
| Svinov | :25 | :45 | 20 min ✓ |
| Studénka | :35 | :55 | 20 min ✓ |
| Hranice | :57 | :17 | 20 min ✓ |

**Hranice → Praha combined:**
- :17 R28
- :33 Ex2 (after -4 shift)
- :57 R18

Intervals: 16-24 min (acceptable, was 0!)

### Hranice → Svinov (Outbound from Praha/Olomouc)

| Station | R18 | R28 | Gap |
|---------|-----|-----|-----|
| Hranice | :58 | :43 | 15 min ✓ |
| Studénka | :08 | :53 | 15 min ✓ |
| Svinov | :30 | :15 | 15 min ✓ |

**Why R28 outbound +13 min (not +28):** Shifting R28 to :30 at Svinov would put it at :58 at Hranice - colliding with R18!

### Ostrava-Svinov → Opava

| Time | Train | Notes |
|------|-------|-------|
| :00 | R27/R60 | From Opava (alternating hourly) |
| :15 | R28 | To Opava (15 min after R27/R60) |
| :25 | R18 | To Praha (25 min transfer from R27/R60) |
| :30 | R18 | From Praha |
| :41 | R27/R60 | To Opava (11 min transfer from R18) |
| :45 | R28 | From Opava |

**Intervals from Opava:** :00 (R27/R60) → :45 (R28) → :00 (next R27/R60)
= 45-15-45-15 pattern (compromise due to R18/R28 collision constraint at Hranice)

---

## Trade-offs

| Improvement | Trade-off |
|-------------|-----------|
| Praha outbound: 15-15-15-15 | - |
| Hranice inbound collision fixed: 0→20 min | - |
| Hranice outbound: R18/R28 15 min apart | Was 28 min, now 15 min (still good) |
| Svinov → Opava: R27/R60 to R28 gap | 15 min (good, was 2 min!) |
| Svinov transfer Opava→Praha | 25 min wait (was 5 min) |

---

## Transfer Times at Ostrava-Svinov

| From | To | Wait | Verdict |
|------|----|------|---------|
| R27/R60 (:00) | R28 to Opava (:15) | 15 min | Good ✓ |
| R27/R60 (:00) | R18 to Praha (:25) | 25 min | Acceptable |
| R18 from Praha (:30) | R27/R60 to Opava (:41) | 11 min | Good ✓ |
| R28 from Opava (:45) | R18 to Praha (:25+60) | 40 min | Long |

**Note:** R28 at :15 avoids collision with R18 at Hranice (:43 vs :58 = 15 min gap).

---

## Implementation Checklist

- [x] Ex2: -4 min (both directions) - 39 timetables
- [x] Ex11: -23 min (both directions) - 78 timetables
- [x] R18 inbound: +20 min - 18 timetables
- [x] R28 outbound: +13 min - 19 timetables
- [x] R28 inbound: +15 min - 20 timetables

**Applied: 174 timetables total**

---

## Alternative Considered

**R18 inbound +10 min only:**
- Pros: Better R18/R28 gap (15 min)
- Cons: Hranice Ex2/R18 gap only 10 min (vs 20 min in proposed)

Rejected because fixing the Hranice collision is higher priority.
