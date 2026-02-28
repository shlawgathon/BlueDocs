"""BlueRegistry Backend — FastAPI application entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.analysis import router as analysis_router
from app.routes.layers import router as layers_router
from app.services.geodata import GeoDataService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: fetch and cache all GeoJSON data."""
    logger.info("Starting BlueRegistry backend — loading GeoJSON data...")
    geodata = GeoDataService()
    await geodata.load_all()
    app.state.geodata = geodata
    logger.info("All layers loaded. Server ready.")
    yield
    logger.info("Shutting down BlueRegistry backend.")


app = FastAPI(
    title="BlueRegistry API",
    description="Spatial Intelligence for the Blue Economy",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(layers_router)
app.include_router(analysis_router)


@app.get("/health")
async def health():
    """Health check endpoint."""
    geodata = app.state.geodata
    layer_counts = {
        lid: len(layer.geometries) for lid, layer in geodata.layers.items()
    }
    return {
        "status": "healthy",
        "layers_loaded": len(geodata.layers),
        "feature_counts": layer_counts,
    }
