# VRT - Train Line Management System

A Next.js application for managing fictional train lines, viewing timetables, and displaying departure boards.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## JSON Data Structure

All data is stored in the `data/` folder. Edit these files directly to manage your train network.

### stations.json

Defines all stations in your network.

```json
{
  "stations": [
    {
      "id": "570762",
      "code": "PHN",
      "name": "Praha hlavní nádraží",
      "type": "hub",
      "platforms": 16,
      "isTerminal": false
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier for the station |
| `code` | string | Short code displayed in badges (e.g., "PHN") |
| `name` | string | Full station name |
| `type` | string | One of: `hub`, `terminal`, `regular`, `airport`, `request` |
| `platforms` | number | Number of platforms at the station |
| `isTerminal` | boolean | Whether trains terminate here |

**Station Types:**
- `hub` - Major interchange station
- `terminal` - End of line station
- `regular` - Standard station
- `airport` - Airport connection
- `request` - Request stop (train stops only on demand)

---

### lines.json

Defines train lines with their identifiers and colors.

```json
{
  "lines": [
    {
      "id": "spr1",
      "identifier": "Spr1",
      "name": "Sprinter 1",
      "color": "#E31E24",
      "textColor": "#FFFFFF",
      "type": "suburban",
      "variants": ["Spr1", "Spr1a"]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier for the line |
| `identifier` | string | Display code shown in badges (e.g., "Spr1", "R5", "IC2") |
| `name` | string | Full line name |
| `color` | string | Background color for the line badge (hex) |
| `textColor` | string | Text color for the line badge (hex) |
| `type` | string | One of: `suburban`, `regional`, `intercity`, `express`, `local` |
| `variants` | string[] | List of variant codes for this line |

---

### variants.json

Defines route variants - the specific paths trains take, including which stations they stop at.

```json
{
  "variants": [
    {
      "id": "spr1-out",
      "lineId": "spr1",
      "code": "Spr1",
      "name": "Spr1 Full Route",
      "direction": "outbound",
      "stations": [
        {
          "stationId": "570762",
          "sequence": 1,
          "arrivalOffset": null,
          "departureOffset": 0,
          "platform": "3",
          "stopType": "regular"
        },
        {
          "stationId": "01",
          "sequence": 2,
          "arrivalOffset": 95,
          "departureOffset": 97,
          "platform": "1",
          "stopType": "regular"
        }
      ]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier for the variant |
| `lineId` | string | Reference to the parent line's `id` |
| `code` | string | Variant code (e.g., "Spr1", "Spr1a") |
| `name` | string | Descriptive name for the variant |
| `direction` | string | Either `outbound` or `inbound` |
| `stations` | array | Ordered list of stops (see below) |

**Station Stop Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `stationId` | string | Reference to station's `id` |
| `sequence` | number | Order of stop (1, 2, 3...) |
| `arrivalOffset` | number \| null | Minutes from first departure to arrival here. `null` for first station. |
| `departureOffset` | number \| null | Minutes from first departure to departure here. `null` for last station. |
| `platform` | string | Default platform number |
| `stopType` | string | One of: `regular`, `request`, `pass` |

**Example timing:** If a train departs the first station at 05:00:
- `arrivalOffset: 95` means arrival at 06:35
- `departureOffset: 97` means departure at 06:37

---

### timetables.json

Defines actual train services with their departure times.

```json
{
  "timetables": [
    {
      "id": "spr1-001",
      "variantId": "spr1-out",
      "trainNumber": "Spr1-001",
      "operatingDays": ["weekdays"],
      "departures": [
        {
          "stationId": "570762",
          "arrival": null,
          "departure": "05:00",
          "platform": "3"
        },
        {
          "stationId": "01",
          "arrival": "06:35",
          "departure": "06:37",
          "platform": "1"
        }
      ]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier for the timetable entry |
| `variantId` | string | Reference to variant's `id` |
| `trainNumber` | string | Train service number (displayed in timetables) |
| `operatingDays` | string[] | When this service runs (see below) |
| `departures` | array | Actual times for each stop |

**Operating Days Options:**
- Individual days: `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`
- Groups: `weekdays` (Mon-Fri), `weekends` (Sat-Sun)

**Departure Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `stationId` | string | Reference to station's `id` |
| `arrival` | string \| null | Arrival time in "HH:MM" format. `null` for first station. |
| `departure` | string \| null | Departure time in "HH:MM" format. `null` for last station. |
| `platform` | string | Platform number for this specific service |

---

## Adding a New Line

1. **Add stations** to `stations.json` (if they don't exist)

2. **Add the line** to `lines.json`:
   ```json
   {
     "id": "r10",
     "identifier": "R10",
     "name": "Regional East",
     "color": "#FF6B00",
     "textColor": "#FFFFFF",
     "type": "regional",
     "variants": ["R10"]
   }
   ```

3. **Add variants** to `variants.json` (one for each direction):
   ```json
   {
     "id": "r10-out",
     "lineId": "r10",
     "code": "R10",
     "name": "R10 Outbound",
     "direction": "outbound",
     "stations": [
       { "stationId": "...", "sequence": 1, ... }
     ]
   }
   ```

4. **Add timetable entries** to `timetables.json`:
   ```json
   {
     "id": "r10-001",
     "variantId": "r10-out",
     "trainNumber": "R10-001",
     "operatingDays": ["weekdays"],
     "departures": [...]
   }
   ```

---

## Project Structure

```
vrt/
├── app/                    # Next.js pages
│   ├── lines/             # Train lines views
│   ├── stations/          # Station views
│   └── departures/        # Departure boards
├── components/            # React components
├── lib/data/              # Data access functions
├── types/                 # TypeScript interfaces
└── data/                  # JSON data files
    ├── stations.json
    ├── lines.json
    ├── variants.json
    └── timetables.json
```
