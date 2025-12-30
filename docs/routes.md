# Route Corridors Feature - Implementation Specification

## Overview

Formalize mandatory "route corridors" (named sequences of stations with base times/distances) for all variants.

**Workflow:** Stations → Routes → Lines → Variants (routes required)

When creating a variant, user must select a route first. Times are prefilled from the route, then manually adjusted.

---

## Data Model

### New Types (add to `types/index.ts`)

```typescript
// A stop within a route path
interface RoutePathStop {
  stationId: string;
  sequence: number;
  distanceFromPrevious: number;   // Segment distance in km (user enters this)
  distanceKm: number;             // Cumulative distance from path start (auto-calculated)
  baseTimeFromPrevious: number;   // Minutes from previous stop
  defaultDwellTime: number;       // Default stop duration (minutes)
}

// A path through a route (one way to traverse the corridor)
interface RoutePath {
  id: string;
  name: string;                   // Freeform text, e.g., "via VRT", "via Jihlava"
  stops: RoutePathStop[];
  // Optional: direction-specific timing overrides (toggle on demand in UI)
  reverseTimeAdjustments?: {
    stationId: string;
    baseTimeFromPrevious: number; // Different time when going in reverse
  }[];
}

// Route corridor entity - contains multiple paths
interface RouteCorridor {
  id: string;
  name: string;                   // Freeform text, e.g., "Praha-Brno Corridor"
  description?: string;
  paths: RoutePath[];             // Multiple alternative paths through this corridor
  createdAt: string;
  updatedAt: string;
}

// Reference to a route+path used by a variant (can have multiple)
interface VariantRouteRef {
  routeId: string;
  pathId: string;
  direction: Direction;
  startStationId?: string;        // Where to join this route (optional subset)
  endStationId?: string;          // Where to leave this route (optional subset)
}
```

### Modify Variant Type

```typescript
interface Variant {
  id: string;
  lineId: string;
  code: string;
  name: string;
  direction: Direction;
  routeRefs: VariantRouteRef[];   // REQUIRED - one or more route references
  stations: VariantStop[];        // Actual stops with adjusted times
  outOfSync?: boolean;            // Flag when source route has changed
}
```

### Key Concepts

- **Route** = corridor (e.g., "Praha-Brno")
- **Path** = one way through the corridor (e.g., "via VRT", "via Jihlava")
- **Variant** = actual service that uses parts of one or more routes

---

## Business Rules

### Route Updates & Variant Sync

1. When a route corridor's base times/distances are updated, all variants referencing it are flagged with `outOfSync: true`
2. Variants require **explicit review** before changes take effect
3. "Resync times from route" action performs a **full reset** - all manual adjustments are lost
4. **Sync status visibility:**
   - Warning badge next to affected variants in list view
   - Dedicated "Needs Review" section on admin dashboard
   - Banner on the variant edit page itself

### Route Chaining (Multi-route Variants)

1. **Junction validation required:** End station of one route segment must exactly match start station of next
2. No gaps or overlaps allowed between chained route segments
3. Full station list preview updates in real-time as routes are selected

### Path Editing Rules

1. **Structural lock:** Once a path is used by any variant, it is locked from structural changes
2. Locked paths allow only time/distance edits, not station add/remove/reorder
3. Stations can only be appended to the end of a path (remove and re-add to change order)

### Shared Stops Across Paths

1. **Endpoint sync:** First and last stations (corridor terminals) sync across all paths in a corridor
2. Intermediate stops are independent per path

### Deletion Rules

1. **Block deletion:** Route corridors cannot be deleted if any variant references them
2. Must remove all variant references before deletion is allowed

---

## Distance & Time Handling

### Distance Entry

1. User enters **distance from previous stop** (segment distance)
2. System auto-calculates **cumulative distance** from path start
3. Distances recalculate when stations are added/removed

### Reverse Time Adjustments

1. Default: symmetric times (same in both directions)
2. Optional toggle reveals adjustment fields for asymmetric timing
3. When variant uses reverse direction, times from `reverseTimeAdjustments` are used if defined

### Time Display in Variant Editor

1. Show **two columns**: "Base" and "Adjusted" for each segment
2. User sees both the route's base time and their customized value

---

## Platform Assignment

1. If station has **1 platform**: auto-assign that platform
2. If station has **multiple platforms**: mark as "needs selection" (placeholder/default marker)
3. Platform defaults come from station metadata, not route data
4. Final platform assignment is per-variant

---

## Dwell Time

1. Route stores single `defaultDwellTime` per stop
2. Stop-type-specific adjustments (regular vs request stop) happen at variant level only

---

## UI Flow

### 1. Route Management (`/admin/routes`)

**List View:**
- Flat alphabetical list with search/filter by name
- Each route shows: name, paths count, total stations
- No grouping or region metadata for MVP

**Route Editor (RouteCorridorEditor):**
- Route name (freeform text) + optional description
- Paths section: add/edit/delete paths
- Each path editable via RoutePathEditor

**Path Editor (RoutePathEditor):**
- Path name (freeform text)
- Station sequence with distance/time/dwell per stop
- **Keyboard support:**
  - Type station name to search
  - Tab to move between fields
  - Shortcuts for add/delete
- Reverse timing adjustments: toggle to reveal (hidden by default)
- **Validation:** All fields required - positive times, distances, dwell times

### 2. Variant Creation (routes REQUIRED)

**Step 1: Build Route Sequence (RouteSequenceBuilder)**
- Add route segments: pick Route → Path → Start/End stations
- Start/End subset selection via two dropdowns
- Can add multiple route segments (junction validation enforced)
- **Full preview:** Complete station list updates in real-time as selections change

**Step 2: Customize Variant**
- Variant info: code, name, direction
- Station list prefilled from selected routes/paths:
  - Times editable with two-column display (Base | Adjusted)
  - Platform assignment (auto-filled or "needs selection")
  - Stop type (regular/request/pass)
- Preview panel shows total time
- **Reverse variants:** Station display is in travel order (flipped from route order)

**Navigation:**
- Can go back to Step 1 from Step 2
- Warning displayed that customizations will be lost

**Fork Option:**
- Fork from existing variant copies everything: route refs, all time adjustments, platform assignments, stop types

### 3. Editing Existing Variant

- Header shows route references: "Routes: Praha-Brno (via VRT) + Brno-Ostrava"
- "Resync times from route" button (full reset with confirmation)
- Can modify which routes/paths are used (clears customizations)
- Out-of-sync banner displayed if source route changed

---

## Files to Create

| File                                      | Purpose                                        |
|-------------------------------------------|------------------------------------------------|
| `data/routes.json`                        | Route corridors data store                     |
| `lib/data/routes.ts`                      | CRUD operations for routes                     |
| `app/api/admin/routes/route.ts`           | GET all / POST new route                       |
| `app/api/admin/routes/[id]/route.ts`      | GET / PUT / DELETE single route                |
| `app/admin/routes/page.tsx`               | Route list page                                |
| `app/admin/routes/new/page.tsx`           | Create route page                              |
| `app/admin/routes/[id]/page.tsx`          | Edit route page                                |
| `components/admin/RouteCorridorEditor.tsx`| Route editor (name, paths)                     |
| `components/admin/RoutePathEditor.tsx`    | Path editor (stations, times) with keyboard   |
| `components/admin/RouteSequenceBuilder.tsx`| Build route sequence for variant (multi-route)|

## Files to Modify

| File                                         | Changes                                     |
|----------------------------------------------|---------------------------------------------|
| `types/index.ts`                             | Add RouteCorridor types, extend Variant     |
| `lib/data/index.ts`                          | Export route functions                      |
| `components/admin/index.ts`                  | Export new components                       |
| `components/admin/AdminSidebar.tsx`          | Add "Routes" nav link                       |
| `app/admin/lines/[id]/variants/new/page.tsx` | Add route selection step                    |
| `app/admin/lines/[id]/variants/[vid]/page.tsx`| Show route reference, sync status          |
| `app/admin/page.tsx` (dashboard)             | Add "Needs Review" section for out-of-sync  |

---

## Implementation Phases

### Phase 1: Data Layer
1. Add types to `types/index.ts`
2. Update Variant type with `routeRefs: VariantRouteRef[]` and `outOfSync?: boolean`
3. Create `data/routes.json` with `{ "routes": [] }`
4. Create `lib/data/routes.ts` with CRUD functions
5. Add endpoint sync logic for shared first/last stations across paths

### Phase 2: API Layer
1. Create `/api/admin/routes/route.ts` (GET all / POST new)
2. Create `/api/admin/routes/[id]/route.ts` (GET / PUT / DELETE)
3. Add validation: complete data required, block deletion if referenced
4. Add logic to flag variants as out-of-sync when routes change

### Phase 3: Route Admin UI
1. Create `RoutePathEditor.tsx` - edit stations with full keyboard support
2. Create `RouteCorridorEditor.tsx` - manage route with multiple paths
3. Create route admin pages (list with search, new, edit)
4. Add "Routes" link to AdminSidebar

### Phase 4: Variant Integration
1. Create `RouteSequenceBuilder.tsx` - pick routes + paths + subsets with full preview
2. Create prefill logic: route sequence → VariantStop[]
3. Modify variant new page with two-step flow (route selection → customization)
4. Modify variant edit page to show route references, sync status, resync action
5. Update variant API to require routeRefs
6. Add out-of-sync dashboard section

### Phase 5: Public Pages (Post-MVP)
1. Add commercial speed (km/h) calculation to presentation pages
2. Display total distance, total time, and average speed

---

## Notes

- All existing variants will be cleared - clean slate (only station data exists)
- Routes are mandatory for all new variants
- No network visualization for MVP
- No import from external sources (manual route creation only)
- Path names and corridor names are freeform (no enforced format)
