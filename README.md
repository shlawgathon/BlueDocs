# BlueDocs

**Spatial Intelligence for the Blue Economy**

Bluedocs is an interactive ocean planning tool that lets users propose offshore projects—wind farms, aquaculture sites, subsea cables—and instantly analyze spatial conflicts against real federal datasets. Drop a pin, set a radius, and get a risk score with actionable relocation recommendations.

## Demo Flow

1. **Explore** — Full-screen dark ocean map with toggleable federal data layers (wind leases, MPAs, shipping lanes, submarine cables)
2. **Propose** — Click anywhere to drop a project pin, choose a type, and set a radius
3. **Analyze** — Conflict engine scores risk 0–100, flags overlapping protected zones and shipping corridors
4. **Optimize** — AI recommender suggests lower-risk locations and flies the map to the new site

## Architecture

| Layer        | Stack                                        | Role                                                                                                                |
| ------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Frontend** | Next.js · React · Mapbox GL JS · Tailwind    | Dark-themed map dashboard with glassmorphism panels, real-time layer rendering, and animated conflict visualization |
| **Accounts** | Convex                                       | Email/password account auth and per-user persisted project lists                                                    |
| **Backend**  | FastAPI · Shapely · Python                   | GeoJSON ingestion, spatial overlap/buffer analysis, risk scoring, and grid-search relocation engine                 |
| **Data**     | BOEM · NOAA · MarineCadastre · TeleGeography | Real federal GeoJSON datasets for wind leases, marine protected areas, shipping lanes, and submarine cables         |

```mermaid
flowchart TD
    subgraph Frontend["Frontend · Next.js + Mapbox GL"]
        Map[Map Dashboard]
        Layers[Layer Panel]
        Modal[Project Modal]
        Panel[Conflict Panel]
    end

    subgraph Backend["Backend · FastAPI + Shapely"]
        API[API Router]
        Geo[GeoDataService]
        Engine[ConflictEngine]
        Rec[Recommender]
    end

    subgraph Data["Federal GeoJSON"]
        D1[(BOEM\nWind Leases)]
        D2[(NOAA\nMPAs)]
        D3[(MarineCadastre\nShipping)]
        D4[(TeleGeography\nCables)]
    end

    Map -- GET /api/layers --> API
    Modal -- POST /api/conflict-check --> API
    API --> Geo --> D1 & D2 & D3 & D4
    API --> Engine --> Geo
    API --> Rec --> Engine
```

## How Project Shapes Work

When a user drops a pin and configures a project, the frontend generates a GeoJSON polygon on the map representing the project's footprint. Four shape types are supported:

| Shape       | How It's Drawn                      | Math                                                                                                               |
| ----------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Circle**  | 64-sided regular polygon            | Vertices at equal angles around center, radius converted from km to degrees via `radiusKm / 6371` (Earth's radius) |
| **Square**  | 4-sided regular polygon rotated 45° | Same algorithm as circle but with 4 vertices and a `π/4` rotation so edges align N/S/E/W                           |
| **Hexagon** | 6-sided regular polygon             | Same algorithm with 6 vertices, no rotation                                                                        |
| **Drawn**   | Freehand polygon from user clicks   | User clicks points on the map; centroid and bounding radius are computed via haversine distance                    |

All shapes ultimately call `createRegularPolygonGeoJSON(lng, lat, radiusKm, sides, properties, rotation)`:

```
for i in 0..sides:
    angle = (i / sides) × 2π + rotation
    dLat  = (radiusKm / 6371) × cos(angle)
    dLng  = (radiusKm / 6371) × sin(angle) / cos(lat)
    → [lng + dLng, lat + dLat]  (converted to degrees)
```

The resulting polygon is rendered on the Mapbox map as a semi-transparent fill with a dashed border. It's also sent to the backend's **ConflictEngine**, which uses Shapely to:

1. **Overlap check** — `project_polygon.intersects(layer_geometry)` → flags direct spatial conflicts
2. **Buffer check** — Expands the project polygon by each layer's buffer distance (2–10 km) and checks for nearby features
3. **Scoring** — Overlap area (km²) and proximity (km) feed into the 0–100 risk score

## Key Endpoints

```
GET  /health              → service status + loaded layer counts
GET  /api/layers           → all GeoJSON layers for map rendering
POST /api/conflict-check   → spatial analysis with risk score + recommendation
```

## Quickstart

```bash
# Backend
cd backend
uv sync
uv run uvicorn app.main:app --port 8000

# Frontend
cd frontend
bun install
bun run convex:dev  # in another terminal (first run will set up your Convex deployment)
bun run dev
```

Required frontend env vars:

- `NEXT_PUBLIC_MAPBOX_TOKEN`
- `NEXT_PUBLIC_CONVEX_URL` (from Convex dashboard / `convex dev`)

## Team

Built by **Krish** (backend + AI) and **Partner** (frontend + UX).
