"use client";

import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import Map, {
  Source,
  Layer,
  Marker,
  MapRef,
  MapMouseEvent,
  MarkerDragEvent,
  Popup,
} from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

import type {
  Layer as LayerData,
  ConflictCheckResponse,
} from "@/lib/types";
import { API_URL, fetchLayers, checkConflicts } from "@/lib/api";
import type { StoredProjectRecord } from "@/lib/convexAccount";
import {
  clearStoredAccountToken,
  fetchAccountProjects,
  getCurrentAccount,
  getStoredAccountToken,
  replaceAccountProjects,
  sendAnalysisNotification,
  setStoredAccountToken,
  signInAccount,
  signOutAccount,
  signUpAccount,
} from "@/lib/convexAccount";
import { getLayerSourceMeta, getLayerSourceMetaById } from "@/lib/layerSources";
import { AuthModal } from "@/components/AuthModal";
import { Header } from "@/components/Header";
import { LayerPanel } from "@/components/LayerPanel";
import { ProjectModal } from "@/components/ProjectModal";
import { ConflictPanel } from "@/components/ConflictPanel";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

type MapStyle = "dark" | "light" | "satellite";
type ProjectShapeType = "circle" | "square" | "hexagon" | "drawn";

interface ProjectConfig {
  projectType: string;
  radiusKm: number;
  name: string;
  shapeType: ProjectShapeType;
}

interface ProjectRecord {
  id: string;
  lat: number;
  lng: number;
  config: ProjectConfig;
  analysisResult: ConflictCheckResponse | null;
  customPolygon?: [number, number][];
}

type AuthMode = "login" | "signup";

interface PopupState {
  lng: number;
  lat: number;
  text: string;
  mode: "hover" | "click";
  sourceUrl?: string;
  sourceName?: string;
}

const MAP_STYLES: Record<MapStyle, string> = {
  dark: "mapbox://styles/mapbox/dark-v11",
  light: "mapbox://styles/mapbox/light-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};

const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  projectType: "offshore_wind",
  radiusKm: 25,
  name: "",
  shapeType: "circle",
};

export default function MapDashboard() {
  const mapRef = useRef<MapRef>(null);

  // Data
  const [layers, setLayers] = useState<LayerData[]>([]);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interaction state
  const [placementMode, setPlacementMode] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"new" | "edit">("new");
  const [draftLocation, setDraftLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [analyzingProjectId, setAnalyzingProjectId] = useState<string | null>(null);
  const [showConflictPanel, setShowConflictPanel] = useState(false);
  const [hoveredConflictLayer, setHoveredConflictLayer] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>("satellite");
  const [lastLayersFetchAt, setLastLayersFetchAt] = useState<Date | null>(null);
  const [lastConflictFetchAt, setLastConflictFetchAt] = useState<Date | null>(null);
  const [apiLinksOpen, setApiLinksOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [accountToken, setAccountToken] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [accountProjectsReady, setAccountProjectsReady] = useState(false);

  // Draw mode
  const [shapeDrawProjectId, setShapeDrawProjectId] = useState<string | null>(null);
  const [shapeDraftPoints, setShapeDraftPoints] = useState<[number, number][]>([]);

  // Popup
  const [popup, setPopup] = useState<PopupState | null>(null);

  const analyzing = Boolean(analyzingProjectId);
  const isDrawingShape = shapeDrawProjectId !== null;

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const editingProject = useMemo(
    () => projects.find((project) => project.id === editingProjectId) ?? null,
    [editingProjectId, projects]
  );

  const selectedAnalysisResult = selectedProject?.analysisResult ?? null;
  const layerMap = useMemo(
    () => new globalThis.Map<string, LayerData>(layers.map((layer) => [layer.id, layer])),
    [layers]
  );
  const lastApiFetchAt = useMemo(() => {
    const layerTime = lastLayersFetchAt?.getTime() ?? 0;
    const conflictTime = lastConflictFetchAt?.getTime() ?? 0;
    const latest = Math.max(layerTime, conflictTime);
    return latest > 0 ? new Date(latest) : null;
  }, [lastConflictFetchAt, lastLayersFetchAt]);

  const apiLinkGroups = useMemo(() => {
    const appLinks = [
      { label: "GET /api/layers", url: `${API_URL}/api/layers` },
      { label: "POST /api/conflict-check", url: `${API_URL}/api/conflict-check` },
      { label: "API docs", url: `${API_URL}/docs` },
    ];

    const datasetMap = new globalThis.Map<string, string>();
    layers.forEach((layer) => {
      const source = getLayerSourceMeta(layer);
      if (source) {
        datasetMap.set(source.source_url, source.source_name);
      }
    });
    const datasetLinks = Array.from(datasetMap.entries()).map(([url, label]) => ({
      label,
      url,
    }));

    return { appLinks, datasetLinks };
  }, [layers]);

  const activeProjectLayerIds = useMemo(
    () => projects.map((project) => `project-${project.id}-fill`),
    [projects]
  );

  const interactiveLayerIds = useMemo(() => {
    const dataLayerIds = layers
      .filter((layer) => layerVisibility[layer.id])
      .map((layer) => `${layer.id}-layer`);
    return [...dataLayerIds, ...activeProjectLayerIds];
  }, [activeProjectLayerIds, layerVisibility, layers]);

  const drawingLineGeoJSON = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!isDrawingShape || shapeDraftPoints.length < 2) return null;

    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: shapeDraftPoints,
          },
        },
      ],
    };
  }, [isDrawingShape, shapeDraftPoints]);

  const drawingPolygonGeoJSON = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!isDrawingShape || shapeDraftPoints.length < 3) return null;

    const closed = closeRing(shapeDraftPoints);
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [closed],
          },
        },
      ],
    };
  }, [isDrawingShape, shapeDraftPoints]);

  // Fetch layers on mount
  useEffect(() => {
    fetchLayers()
      .then((data) => {
        setLayers(data.layers);
        setLastLayersFetchAt(new Date());
        const visibility: Record<string, boolean> = {};
        data.layers.forEach((layer) => {
          visibility[layer.id] = layer.visible;
        });
        setLayerVisibility(visibility);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrateAccount = async () => {
      const token = getStoredAccountToken();
      if (!token) {
        if (!cancelled) {
          setAccountToken(null);
          setAccountEmail(null);
          setAccountProjectsReady(false);
          setAuthChecking(false);
        }
        return;
      }

      try {
        const user = await getCurrentAccount(token);
        if (!user) {
          clearStoredAccountToken();
          if (!cancelled) {
            setAccountToken(null);
            setAccountEmail(null);
            setAccountProjectsReady(false);
            setProjects([]);
            setSelectedProjectId(null);
          }
          return;
        }

        const accountProjects = await fetchAccountProjects(token);
        if (cancelled) return;

        setAccountToken(token);
        setAccountEmail(user.email);
        setProjects(accountProjects.map(fromStoredProject));
        setSelectedProjectId(accountProjects[0]?.id ?? null);
        setShowConflictPanel(false);
        setHoveredConflictLayer(null);
        setAccountProjectsReady(true);
      } catch (e) {
        clearStoredAccountToken();
        if (!cancelled) {
          setAccountToken(null);
          setAccountEmail(null);
          setAccountProjectsReady(false);
          setProjects([]);
          setSelectedProjectId(null);
          setError(e instanceof Error ? e.message : "Failed to initialize account.");
        }
      } finally {
        if (!cancelled) {
          setAuthChecking(false);
        }
      }
    };

    void hydrateAccount();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!accountToken || !accountProjectsReady) return;

    const timer = window.setTimeout(() => {
      replaceAccountProjects(
        accountToken,
        projects.map((project) => toStoredProject(project))
      ).catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to sync account projects.");
      });
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [accountProjectsReady, accountToken, projects]);

  const handleAuthSubmit = useCallback(
    async (mode: AuthMode, email: string, password: string) => {
      const authResponse =
        mode === "signup"
          ? await signUpAccount(email, password)
          : await signInAccount(email, password);

      const accountProjects = await fetchAccountProjects(authResponse.token);
      setStoredAccountToken(authResponse.token);
      setAccountToken(authResponse.token);
      setAccountEmail(authResponse.user.email);
      setProjects(accountProjects.map(fromStoredProject));
      setSelectedProjectId(accountProjects[0]?.id ?? null);
      setShowConflictPanel(false);
      setHoveredConflictLayer(null);
      setPopup(null);
      setPlacementMode(false);
      setShapeDrawProjectId(null);
      setShapeDraftPoints([]);
      setAccountProjectsReady(true);
      setError(null);
      setAuthModalOpen(false);
    },
    []
  );

  const handleLogout = useCallback(async () => {
    const token = accountToken;
    if (token) {
      try {
        await signOutAccount(token);
      } catch {
        // Ignore logout failures and clear local session anyway.
      }
    }

    clearStoredAccountToken();
    setAccountToken(null);
    setAccountEmail(null);
    setAccountProjectsReady(false);
    setProjects([]);
    setSelectedProjectId(null);
    setShowConflictPanel(false);
    setHoveredConflictLayer(null);
    setPopup(null);
    setPlacementMode(false);
    setShowModal(false);
    setModalMode("new");
    setDraftLocation(null);
    setEditingProjectId(null);
    setShapeDrawProjectId(null);
    setShapeDraftPoints([]);
  }, [accountToken]);

  const toggleLayer = useCallback((layerId: string) => {
    setLayerVisibility((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  }, []);

  const startPlacement = useCallback(() => {
    if (!accountToken) {
      setAuthModalOpen(true);
      setError("Sign in to create and save projects.");
      return;
    }

    setModalMode("new");
    setPlacementMode(true);
    setShowModal(false);
    setShowConflictPanel(false);
    setHoveredConflictLayer(null);
    setDraftLocation(null);
    setEditingProjectId(null);
    setPopup(null);
    setShapeDrawProjectId(null);
    setShapeDraftPoints([]);
  }, [accountToken]);

  const startDrawingShapeForProject = useCallback(
    (projectId: string) => {
      const target = projects.find((project) => project.id === projectId);
      if (!target) return;

      setSelectedProjectId(projectId);
      setShapeDrawProjectId(projectId);
      setShapeDraftPoints(
        target.customPolygon && target.customPolygon.length > 3
          ? target.customPolygon.slice(0, -1)
          : []
      );
      setPlacementMode(false);
      setShowModal(false);
      setShowConflictPanel(false);
      setHoveredConflictLayer(null);
      setPopup(null);
    },
    [projects]
  );

  const cancelDrawingShape = useCallback(() => {
    setShapeDrawProjectId(null);
    setShapeDraftPoints([]);
  }, []);

  const undoShapePoint = useCallback(() => {
    setShapeDraftPoints((prev) => prev.slice(0, -1));
  }, []);

  const removeShapePoint = useCallback((index: number) => {
    setShapeDraftPoints((prev) => prev.filter((_, pointIndex) => pointIndex !== index));
  }, []);

  const finishDrawingShape = useCallback(() => {
    if (!shapeDrawProjectId) return;

    if (shapeDraftPoints.length < 3) {
      setError("Add at least 3 points before finishing the drawn shape.");
      return;
    }

    const closed = closeRing(shapeDraftPoints);
    const centroid = polygonCentroid(closed);
    const estimatedRadius = Math.max(1, estimateRadiusFromPolygonKm(closed, centroid));

    setProjects((prev) =>
      prev.map((project) =>
        project.id === shapeDrawProjectId
          ? {
              ...project,
              lng: centroid[0],
              lat: centroid[1],
              customPolygon: closed,
              analysisResult: null,
              config: {
                ...project.config,
                shapeType: "drawn",
                radiusKm: Number(estimatedRadius.toFixed(1)),
              },
            }
          : project
      )
    );

    setShowConflictPanel(false);
    setHoveredConflictLayer(null);
    setShapeDrawProjectId(null);
    setShapeDraftPoints([]);
  }, [shapeDraftPoints, shapeDrawProjectId]);

  const openEditProject = useCallback(
    (projectId?: string) => {
      const id = projectId ?? selectedProjectId;
      if (!id) return;

      const target = projects.find((project) => project.id === id);
      if (!target) return;

      setSelectedProjectId(id);
      setEditingProjectId(id);
      setModalMode("edit");
      setPlacementMode(false);
      setShowConflictPanel(false);
      setHoveredConflictLayer(null);
      setShowModal(true);
      setPopup(null);
      setShapeDrawProjectId(null);
      setShapeDraftPoints([]);
    },
    [projects, selectedProjectId]
  );

  const removeProject = useCallback(
    (projectId?: string) => {
      const id = projectId ?? selectedProjectId;
      if (!id) return;

      const nextProjects = projects.filter((project) => project.id !== id);
      const nextSelectedId = selectedProjectId === id ? (nextProjects[0]?.id ?? null) : selectedProjectId;
      const nextSelected = nextProjects.find((project) => project.id === nextSelectedId) ?? null;

      setProjects(nextProjects);
      setSelectedProjectId(nextSelectedId);
      setShowConflictPanel(Boolean(nextSelected?.analysisResult));

      if (editingProjectId === id) {
        setShowModal(false);
        setModalMode("new");
        setEditingProjectId(null);
      }

      if (analyzingProjectId === id) {
        setAnalyzingProjectId(null);
      }

      if (shapeDrawProjectId === id) {
        setShapeDrawProjectId(null);
        setShapeDraftPoints([]);
      }

      setHoveredConflictLayer(null);
      setPopup(null);
    },
    [analyzingProjectId, editingProjectId, projects, selectedProjectId, shapeDrawProjectId]
  );

  const updateProjectShapeType = useCallback(
    (projectId: string, shapeType: ProjectShapeType) => {
      const target = projects.find((project) => project.id === projectId);
      if (!target) return;

      setProjects((prev) =>
        prev.map((project) =>
          project.id === projectId
            ? {
                ...project,
                analysisResult: null,
                customPolygon:
                  shapeType === "drawn" ? project.customPolygon : undefined,
                config: {
                  ...project.config,
                  shapeType,
                },
              }
            : project
        )
      );
      setShowConflictPanel(false);
      setHoveredConflictLayer(null);

      if (shapeType === "drawn" && !target.customPolygon) {
        startDrawingShapeForProject(projectId);
      }
    },
    [projects, startDrawingShapeForProject]
  );

  const runAnalysis = useCallback(
    async (
      projectType: string,
      radiusKm: number,
      name: string,
      shapeType: ProjectShapeType
    ) => {
      const trimmedName = name.trim();

      let preparedProject: ProjectRecord | null = null;

      if (modalMode === "new") {
        if (!draftLocation) return;

        const projectId = createProjectId();
        const resolvedName = trimmedName || `Project ${projects.length + 1}`;

        preparedProject = {
          id: projectId,
          lat: draftLocation.lat,
          lng: draftLocation.lng,
          config: {
            projectType,
            radiusKm,
            name: resolvedName,
            shapeType,
          },
          analysisResult: null,
        };

        setProjects((prev) => [preparedProject!, ...prev]);
        setSelectedProjectId(projectId);
      } else {
        const id = editingProjectId ?? selectedProjectId;
        if (!id) return;

        const existing = projects.find((project) => project.id === id);
        if (!existing) return;

        const resolvedName = trimmedName || existing.config.name || `Project ${projects.length}`;

        preparedProject = {
          ...existing,
          customPolygon: shapeType === "drawn" ? existing.customPolygon : undefined,
          analysisResult: null,
          config: {
            projectType,
            radiusKm,
            name: resolvedName,
            shapeType,
          },
        };

        setProjects((prev) =>
          prev.map((project) =>
            project.id === id ? preparedProject! : project
          )
        );
        setSelectedProjectId(id);
      }

      if (!preparedProject) return;

      setShowModal(false);
      setPlacementMode(false);
      setShowConflictPanel(false);
      setHoveredConflictLayer(null);
      setPopup(null);

      if (preparedProject.config.shapeType === "drawn" && !preparedProject.customPolygon) {
        setAnalyzingProjectId(null);
        setModalMode("new");
        setDraftLocation(null);
        setEditingProjectId(null);
        startDrawingShapeForProject(preparedProject.id);
        return;
      }

      const analysisInput = getProjectAnalysisInput(preparedProject);
      setAnalyzingProjectId(preparedProject.id);

      try {
        const result = await checkConflicts({
          project_type: preparedProject.config.projectType,
          latitude: analysisInput.lat,
          longitude: analysisInput.lng,
          radius_km: analysisInput.radiusKm,
          name: preparedProject.config.name || undefined,
        });
        setLastConflictFetchAt(new Date());

        setProjects((prev) =>
          prev.map((project) =>
            project.id === preparedProject!.id
              ? {
                  ...project,
                  lat: analysisInput.lat,
                  lng: analysisInput.lng,
                  analysisResult: result,
                  config: {
                    ...project.config,
                    radiusKm: result.project_circle.radius_km,
                  },
                }
              : project
          )
        );
        setShowConflictPanel(true);

        if (accountEmail) {
          void sendAnalysisNotification(
            accountEmail,
            result,
            preparedProject!.config.name,
            analysisInput.lat,
            analysisInput.lng
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Analysis failed");
      } finally {
        setAnalyzingProjectId(null);
        setModalMode("new");
        setDraftLocation(null);
        setEditingProjectId(null);
      }
    },
    [accountEmail, draftLocation, editingProjectId, modalMode, projects, selectedProjectId, startDrawingShapeForProject]
  );

  const reanalyzeProject = useCallback(
    async (projectId: string) => {
      const project = projects.find((item) => item.id === projectId);
      if (!project) return;

      if (project.config.shapeType === "drawn" && !project.customPolygon) {
        startDrawingShapeForProject(projectId);
        return;
      }

      const analysisInput = getProjectAnalysisInput(project);

      setSelectedProjectId(projectId);
      setAnalyzingProjectId(projectId);
      setShowConflictPanel(false);
      setHoveredConflictLayer(null);
      setPopup(null);

      try {
        const result = await checkConflicts({
          project_type: project.config.projectType,
          latitude: analysisInput.lat,
          longitude: analysisInput.lng,
          radius_km: analysisInput.radiusKm,
          name: project.config.name || undefined,
        });
        setLastConflictFetchAt(new Date());

        setProjects((prev) =>
          prev.map((item) =>
            item.id === projectId
              ? {
                  ...item,
                  lat: analysisInput.lat,
                  lng: analysisInput.lng,
                  analysisResult: result,
                  config: {
                    ...item.config,
                    radiusKm: result.project_circle.radius_km,
                  },
                }
              : item
          )
        );
        setShowConflictPanel(true);

        if (accountEmail) {
          void sendAnalysisNotification(
            accountEmail,
            result,
            project.config.name,
            analysisInput.lat,
            analysisInput.lng
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Analysis failed");
      } finally {
        setAnalyzingProjectId(null);
      }
    },
    [accountEmail, projects, startDrawingShapeForProject]
  );

  const applySuggestion = useCallback(async () => {
    if (!selectedProject?.analysisResult?.recommendation.suggested_lat) return;

    const recommendation = selectedProject.analysisResult.recommendation;
    const newLat = recommendation.suggested_lat;
    const newLon = recommendation.suggested_lon;

    if (newLat == null || newLon == null) return;

    mapRef.current?.flyTo({
      center: [newLon, newLat],
      zoom: 8,
      duration: 2000,
    });

    const deltaLat = newLat - selectedProject.lat;
    const deltaLng = newLon - selectedProject.lng;

    const movedProject: ProjectRecord = {
      ...selectedProject,
      lat: newLat,
      lng: newLon,
      customPolygon: selectedProject.customPolygon
        ? shiftPolygon(selectedProject.customPolygon, deltaLng, deltaLat)
        : selectedProject.customPolygon,
    };

    const analysisInput = getProjectAnalysisInput(movedProject);

    setProjects((prev) =>
      prev.map((project) =>
        project.id === selectedProject.id
          ? {
              ...movedProject,
              lat: analysisInput.lat,
              lng: analysisInput.lng,
            }
          : project
      )
    );

    setAnalyzingProjectId(selectedProject.id);

    try {
      const result = await checkConflicts({
        project_type: movedProject.config.projectType,
        latitude: analysisInput.lat,
        longitude: analysisInput.lng,
        radius_km: analysisInput.radiusKm,
        name: movedProject.config.name || undefined,
      });
      setLastConflictFetchAt(new Date());

      setProjects((prev) =>
        prev.map((project) =>
          project.id === selectedProject.id
            ? {
                ...project,
                analysisResult: result,
                config: {
                  ...project.config,
                  radiusKm: result.project_circle.radius_km,
                },
              }
            : project
        )
      );
      setShowConflictPanel(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-analysis failed");
    } finally {
      setAnalyzingProjectId(null);
    }
  }, [selectedProject]);

  const onMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (apiLinksOpen) {
        setApiLinksOpen(false);
      }

      if (isDrawingShape) {
        setShapeDraftPoints((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
        setPopup(null);
        return;
      }

      if (!placementMode) {
        const safeLayerIds = getExistingLayerIds(mapRef.current, interactiveLayerIds);
        const queryOptions =
          safeLayerIds.length > 0 ? { layers: safeLayerIds } : undefined;
        const features = safeQueryRenderedFeatures(mapRef.current, e.point, queryOptions);

        if (features.length === 0) {
          setPopup(null);
          return;
        }

        const feature = features[0];
        const properties = (feature.properties ?? {}) as Record<string, unknown>;
        const layerId = feature.layer?.id ?? "";
        const projectIdFromProps =
          typeof properties.project_id === "string" ? properties.project_id : null;
        const projectIdFromLayer = parseProjectIdFromLayerId(layerId);
        const projectId = projectIdFromProps ?? projectIdFromLayer;

        if (projectId) {
          const target = projects.find((project) => project.id === projectId);
          setSelectedProjectId(projectId);
          setShowConflictPanel(Boolean(target?.analysisResult));
        }

        const name =
          stringProp(properties.project_name) ||
          (projectId
            ? projects.find((project) => project.id === projectId)?.config.name ?? null
            : null) ||
          stringProp(properties.Site_Name) ||
          stringProp(properties.LEASE_NUMB) ||
          stringProp(properties.NAME) ||
          stringProp(properties.name) ||
          (isLegacyProjectLayerId(layerId)
            ? selectedProject?.config.name ?? null
            : null) ||
          layerId ||
          "Selected feature";

        const baseLayerId = resolveBaseLayerId(layerId);
        const matchedLayer = baseLayerId ? layerMap.get(baseLayerId) : undefined;
        const fallbackSource = baseLayerId
          ? getLayerSourceMetaById(baseLayerId)
          : null;
        const featureUrl =
          firstHttpUrl(properties.url) ??
          firstHttpUrl(properties.URL) ??
          firstHttpUrl(properties.source_url);
        const sourceUrl =
          featureUrl ??
          matchedLayer?.source_url ??
          fallbackSource?.source_url ??
          undefined;
        const sourceName =
          matchedLayer?.source_name ??
          matchedLayer?.name ??
          fallbackSource?.source_name ??
          "Dataset source";

        setPopup({
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
          text: name,
          mode: "click",
          sourceUrl,
          sourceName: sourceUrl ? sourceName : undefined,
        });
        return;
      }

      setDraftLocation({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      setModalMode("new");
      setEditingProjectId(null);
      setShowModal(true);
      setPlacementMode(false);
      setPopup(null);
    },
    [
      apiLinksOpen,
      interactiveLayerIds,
      isDrawingShape,
      layerMap,
      placementMode,
      projects,
      selectedProject?.config.name,
    ]
  );

  const onMapMouseMove = useCallback(
    (e: MapMouseEvent) => {
      if (placementMode || isDrawingShape || popup?.mode === "click") return;

      if (activeProjectLayerIds.length === 0) {
        setPopup((prev) => (prev?.mode === "hover" ? null : prev));
        return;
      }

      const safeLayerIds = getExistingLayerIds(mapRef.current, activeProjectLayerIds);
      const features = safeQueryRenderedFeatures(
        mapRef.current,
        e.point,
        safeLayerIds.length > 0 ? { layers: safeLayerIds } : undefined
      );

      if (features.length === 0) {
        setPopup((prev) => (prev?.mode === "hover" ? null : prev));
        return;
      }

      const properties = (features[0].properties ?? {}) as Record<string, unknown>;
      const layerId = features[0].layer?.id ?? "";
      const projectIdFromProps =
        typeof properties.project_id === "string" ? properties.project_id : null;
      const projectIdFromLayer = parseProjectIdFromLayerId(layerId);
      const projectId = projectIdFromProps ?? projectIdFromLayer;

      const projectName =
        stringProp(properties.project_name) ||
        stringProp(properties.name) ||
        (projectId
          ? projects.find((project) => project.id === projectId)?.config.name ?? null
          : null) ||
        (isLegacyProjectLayerId(layerId) ? selectedProject?.config.name ?? null : null) ||
        "Project";

      setPopup({
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
        text: projectName,
        mode: "hover",
      });
    },
    [activeProjectLayerIds, isDrawingShape, placementMode, popup?.mode, projects, selectedProject?.config.name]
  );

  const clearHoverPopup = useCallback(() => {
    setPopup((prev) => (prev?.mode === "hover" ? null : prev));
  }, []);

  const onMarkerDragEnd = useCallback((projectId: string, event: MarkerDragEvent) => {
    setProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) return project;

        const newLng = event.lngLat.lng;
        const newLat = event.lngLat.lat;

        if (project.config.shapeType === "drawn" && project.customPolygon) {
          const deltaLng = newLng - project.lng;
          const deltaLat = newLat - project.lat;

          return {
            ...project,
            lng: newLng,
            lat: newLat,
            customPolygon: shiftPolygon(project.customPolygon, deltaLng, deltaLat),
            analysisResult: null,
          };
        }

        return {
          ...project,
          lng: newLng,
          lat: newLat,
          analysisResult: null,
        };
      })
    );
    setSelectedProjectId(projectId);
    setShowConflictPanel(false);
    setHoveredConflictLayer(null);
  }, []);

  const modalLocation =
    modalMode === "new"
      ? draftLocation
      : editingProject
        ? {
            lat: editingProject.lat,
            lng: editingProject.lng,
          }
        : null;

  const modalInitialValues =
    modalMode === "edit"
      ? editingProject?.config ?? DEFAULT_PROJECT_CONFIG
      : DEFAULT_PROJECT_CONFIG;

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-[#0A1628]">
      <Header
        onNewProject={startPlacement}
        onMapStyleChange={setMapStyle}
        onOpenAccount={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
        onSimulateApiChange={() => {
          if (!accountEmail) return;
          const project = selectedProject ?? projects[0];
          const name = project?.config.name ?? "Sample Project";
          const lat = project?.lat ?? 42.2;
          const lng = project?.lng ?? -70.5;
          const result = project?.analysisResult ?? {
            risk_score: 78,
            risk_level: "high",
            conflicts: [{ layer_id: "demo", layer_name: "Demo", type: "overlap", severity: "warning", detail: "Simulated" }],
            recommendation: { action: "none", reasoning: "Simulated" },
            project_circle: { center: [lat, lng], radius_km: 25 },
          };
          void sendAnalysisNotification(accountEmail, result, name, lat, lng);
        }}
        placementMode={placementMode}
        mapStyle={mapStyle}
        accountEmail={accountEmail}
        authChecking={authChecking}
      />

      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0A1628]">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-[#14B8A6] border-t-transparent" />
            <p className="text-sm text-slate-400">Loading ocean data layers...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute top-20 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400 backdrop-blur-md">
          {error}
          <button onClick={() => setError(null)} className="ml-3 text-red-300 hover:text-white">&times;</button>
        </div>
      )}

      <div className="absolute top-[70px] right-3 z-40 flex items-start gap-2 sm:right-6">
        <div className="group relative">
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-[#0A1628]/80 px-3 py-1.5 text-[11px] font-semibold text-slate-200 backdrop-blur-md"
          >
            API Status
          </button>
          <div className="pointer-events-none absolute top-full right-0 mt-2 w-72 rounded-lg border border-white/10 bg-[#0A1628]/95 p-3 text-[11px] text-slate-300 opacity-0 shadow-[0_12px_28px_rgba(0,0,0,0.45)] transition-opacity duration-150 group-hover:opacity-100">
            <p className="font-semibold text-slate-100">
              Last fetched: {formatDateTime(lastApiFetchAt)}
            </p>
            <p className="mt-1">Layers API: {formatDateTime(lastLayersFetchAt)}</p>
            <p>Conflict API: {formatDateTime(lastConflictFetchAt)}</p>
            <p className="mt-2 text-slate-400">
              Hover this badge anytime to verify when data was last requested.
            </p>
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setApiLinksOpen((prev) => !prev);
            }}
            className="rounded-lg border border-white/10 bg-[#0A1628]/80 px-3 py-1.5 text-[11px] font-semibold text-cyan-300 backdrop-blur-md transition-colors hover:text-cyan-200"
          >
            API Links
          </button>
          {apiLinksOpen && (
            <div
              className="absolute top-full right-0 mt-2 w-80 rounded-lg border border-white/10 bg-[#0A1628]/95 p-3 text-[11px] shadow-[0_12px_28px_rgba(0,0,0,0.45)]"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="mb-2 font-semibold text-slate-100">BlueDocs API</p>
              <div className="space-y-1.5">
                {apiLinkGroups.appLinks.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setApiLinksOpen(false)}
                    className="block text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline"
                  >
                    {link.label}
                  </a>
                ))}
              </div>

              {apiLinkGroups.datasetLinks.length > 0 && (
                <>
                  <div className="my-2 border-t border-white/10" />
                  <p className="mb-2 font-semibold text-slate-100">Dataset APIs</p>
                  <div className="max-h-36 space-y-1.5 overflow-y-auto">
                    {apiLinkGroups.datasetLinks.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setApiLinksOpen(false)}
                        className="block text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: -71,
          latitude: 41,
          zoom: 6,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLES[mapStyle]}
        cursor={placementMode || isDrawingShape ? "crosshair" : "grab"}
        onClick={onMapClick}
        onMouseMove={onMapMouseMove}
        onMouseLeave={clearHoverPopup}
        interactiveLayerIds={interactiveLayerIds}
      >
        {layers.map((layer) => {
          if (!layerVisibility[layer.id]) return null;
          const isHighlighted = hoveredConflictLayer === layer.id;
          return (
            <Source
              key={layer.id}
              id={layer.id}
              type="geojson"
              data={layer.geojson}
            >
              {layer.type === "polygon" && (
                <Layer
                  id={`${layer.id}-layer`}
                  type="fill"
                  paint={{
                    "fill-color": layer.color,
                    "fill-opacity": isHighlighted ? 0.5 : 0.2,
                  }}
                />
              )}
              {layer.type === "polygon" && (
                <Layer
                  id={`${layer.id}-border`}
                  type="line"
                  paint={{
                    "line-color": layer.color,
                    "line-width": isHighlighted ? 3 : 1.5,
                    "line-opacity": isHighlighted ? 1 : 0.7,
                  }}
                />
              )}
              {layer.type === "line" && (
                <Layer
                  id={`${layer.id}-layer`}
                  type="line"
                  paint={{
                    "line-color": layer.color,
                    "line-width": isHighlighted ? 4 : 2,
                    "line-opacity": isHighlighted ? 1 : 0.7,
                    "line-dasharray": [2, 2],
                  }}
                />
              )}
            </Source>
          );
        })}

        {projects.map((project) => {
          const geojson = createProjectAreaGeoJSON(project);
          if (!geojson) return null;

          const isSelected = selectedProjectId === project.id;
          const isProjectAnalyzing = analyzingProjectId === project.id;

          return (
            <Source
              key={`project-source-${project.id}`}
              id={`project-${project.id}-area`}
              type="geojson"
              data={geojson}
            >
              <Layer
                id={`project-${project.id}-fill`}
                type="fill"
                paint={{
                  "fill-color": isSelected ? "#3B82F6" : "#2563EB",
                  "fill-opacity": isProjectAnalyzing
                    ? 0.35
                    : isSelected
                      ? 0.2
                      : 0.1,
                }}
              />
              <Layer
                id={`project-${project.id}-border`}
                type="line"
                paint={{
                  "line-color": isSelected ? "#14B8A6" : "#3B82F6",
                  "line-width": isSelected ? 2.5 : 1.5,
                  "line-opacity": 0.9,
                }}
              />
            </Source>
          );
        })}

        {isDrawingShape && drawingPolygonGeoJSON && (
          <Source id="shape-draw-polygon" type="geojson" data={drawingPolygonGeoJSON}>
            <Layer
              id="shape-draw-polygon-fill"
              type="fill"
              paint={{
                "fill-color": "#14B8A6",
                "fill-opacity": 0.2,
              }}
            />
            <Layer
              id="shape-draw-polygon-border"
              type="line"
              paint={{
                "line-color": "#14B8A6",
                "line-width": 2,
                "line-opacity": 0.9,
              }}
            />
          </Source>
        )}

        {isDrawingShape && drawingLineGeoJSON && (
          <Source id="shape-draw-line" type="geojson" data={drawingLineGeoJSON}>
            <Layer
              id="shape-draw-line-layer"
              type="line"
              paint={{
                "line-color": "#22D3EE",
                "line-width": 2,
                "line-dasharray": [1.5, 1.5],
              }}
            />
          </Source>
        )}

        {projects.map((project) => {
          const isSelected = selectedProjectId === project.id;
          const hasAnalysis = Boolean(project.analysisResult);

          return (
            <Marker
              key={`project-marker-${project.id}`}
              longitude={project.lng}
              latitude={project.lat}
              draggable
              onDragStart={() => setSelectedProjectId(project.id)}
              onDragEnd={(event) => onMarkerDragEnd(project.id, event)}
            >
              <button
                type="button"
                title={`${project.config.name} (drag to reposition)`}
                className={`group relative h-5 w-5 rounded-full border-2 border-white shadow-[0_0_24px_rgba(20,184,166,0.6)] ${
                  isSelected ? "bg-[#14B8A6]" : "bg-[#3B82F6]"
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedProjectId(project.id);
                  setShowConflictPanel(hasAnalysis);
                  setPopup({
                    lng: project.lng,
                    lat: project.lat,
                    text: project.config.name,
                    mode: "click",
                  });
                }}
                onMouseEnter={(event) => {
                  event.stopPropagation();
                  if (popup?.mode === "click") return;
                  setPopup({
                    lng: project.lng,
                    lat: project.lat,
                    text: project.config.name,
                    mode: "hover",
                  });
                }}
                onMouseLeave={clearHoverPopup}
              >
                <span className="absolute -inset-2 rounded-full border border-[#14B8A6]/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </button>
            </Marker>
          );
        })}

        {isDrawingShape &&
          shapeDraftPoints.map((point, idx) => (
            <Marker
              key={`shape-point-${idx}`}
              longitude={point[0]}
              latitude={point[1]}
            >
              <button
                type="button"
                title="Delete point"
                onClick={(event) => {
                  event.stopPropagation();
                  removeShapePoint(idx);
                }}
                className="h-3 w-3 rounded-full border border-white bg-[#22D3EE] shadow-[0_0_10px_rgba(34,211,238,0.6)] transition-transform hover:scale-110"
              />
            </Marker>
          ))}

        {popup && (
          <Popup
            longitude={popup.lng}
            latitude={popup.lat}
            closeOnClick
            onClose={() => setPopup(null)}
            className="map-popup"
          >
            <p className="text-sm font-medium text-slate-100">{popup.text}</p>
            {popup.sourceUrl && (
              <a
                href={popup.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-xs text-cyan-300 underline-offset-2 hover:underline"
              >
                Source: {popup.sourceName ?? "Official dataset"}
              </a>
            )}
          </Popup>
        )}
      </Map>

      <LayerPanel
        layers={layers}
        visibility={layerVisibility}
        onToggle={toggleLayer}
      />

      <div className="absolute bottom-6 left-6 z-20 w-[340px] rounded-xl border border-white/10 bg-[#0A1628]/75 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Projects</h3>
          <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">
            {projects.length}
          </span>
        </div>

        {!accountToken ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-400">
              Sign in to create and sync projects with your Convex account.
            </p>
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="rounded-md border border-[#14B8A6]/40 bg-[#14B8A6]/10 px-3 py-1.5 text-[11px] font-semibold text-[#14B8A6] transition-colors hover:bg-[#14B8A6]/20"
            >
              Sign In or Create Account
            </button>
          </div>
        ) : projects.length === 0 ? (
          <p className="text-xs text-slate-400">
            No projects yet. Click &quot;New Project&quot; and place one on the map.
          </p>
        ) : (
          <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
            {projects.map((project) => {
              const isSelected = selectedProjectId === project.id;
              const isProjectAnalyzing = analyzingProjectId === project.id;
              const riskLabel = project.analysisResult?.risk_level ?? "not analyzed";

              return (
                <div
                  key={project.id}
                  className={`rounded-lg border p-3 ${
                    isSelected
                      ? "border-[#14B8A6]/50 bg-[#14B8A6]/10"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setShowConflictPanel(Boolean(project.analysisResult));
                      mapRef.current?.flyTo({
                        center: [project.lng, project.lat],
                        zoom: 7,
                        duration: 600,
                      });
                    }}
                  >
                    <p className="truncate text-sm font-semibold text-white">
                      {project.config.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {project.config.projectType.replace("_", " ")} · {project.config.radiusKm}km
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Shape: {project.config.shapeType}
                    </p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">
                      {riskLabel}
                    </p>
                  </button>

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => reanalyzeProject(project.id)}
                      disabled={isProjectAnalyzing}
                      className="rounded-md border border-[#14B8A6]/50 bg-[#14B8A6]/10 px-2 py-1 text-[11px] font-semibold text-[#14B8A6] transition-colors hover:bg-[#14B8A6]/20 disabled:opacity-60"
                    >
                      {isProjectAnalyzing ? "Analyzing..." : "Analyze"}
                    </button>
                    <button
                      onClick={() => openEditProject(project.id)}
                      className="rounded-md border border-white/20 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-white/[0.08]"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => removeProject(project.id)}
                      className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-300 transition-colors hover:bg-red-500/20"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value={project.config.shapeType}
                      onChange={(event) =>
                        updateProjectShapeType(
                          project.id,
                          event.target.value as ProjectShapeType
                        )
                      }
                      className="flex-1 rounded-md border border-white/20 bg-black/30 px-2 py-1 text-[11px] text-slate-200 outline-none"
                    >
                      <option value="circle">Circle</option>
                      <option value="square">Square</option>
                      <option value="hexagon">Hexagon</option>
                      <option value="drawn">Drawn Polygon</option>
                    </select>
                    <button
                      onClick={() => startDrawingShapeForProject(project.id)}
                      disabled={project.config.shapeType !== "drawn"}
                      className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Draw
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {authModalOpen && (
        <AuthModal
          onClose={() => setAuthModalOpen(false)}
          onSubmit={handleAuthSubmit}
        />
      )}

      {showModal && modalLocation && (
        <ProjectModal
          key={`${modalMode}-${editingProjectId ?? "new"}-${modalLocation.lat}-${modalLocation.lng}`}
          lat={modalLocation.lat}
          lng={modalLocation.lng}
          onAnalyze={runAnalysis}
          initialValues={modalInitialValues}
          title={modalMode === "edit" ? "Edit Project" : "Project Configuration"}
          actionLabel={modalMode === "edit" ? "Update Analysis" : "Analyze Conflicts"}
          onClose={() => {
            setShowModal(false);
            setModalMode("new");
            setEditingProjectId(null);
            if (modalMode === "new") {
              setDraftLocation(null);
            }
          }}
        />
      )}

      {showConflictPanel && selectedAnalysisResult && selectedProject && (
        <ConflictPanel
          result={selectedAnalysisResult}
          projectName={selectedProject.config.name}
          analyzing={analyzing}
          onClose={() => {
            setShowConflictPanel(false);
            setHoveredConflictLayer(null);
          }}
          onApplySuggestion={applySuggestion}
          onConflictHover={setHoveredConflictLayer}
        />
      )}

      {placementMode && !isDrawingShape && (
        <div className="absolute bottom-10 left-1/2 z-30 -translate-x-1/2 animate-fade-in-up rounded-full border border-white/10 bg-black/80 px-6 py-3 text-sm text-slate-300 backdrop-blur-md">
          Click anywhere on the map to place a new project
        </div>
      )}

      {isDrawingShape && (
        <div className="absolute right-6 top-[80px] z-30 rounded-xl border border-cyan-400/30 bg-black/75 p-3 backdrop-blur-md">
          <p className="mb-2 text-xs text-cyan-200">
            Draw mode: click map to add points, click a node to delete it
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={undoShapePoint}
              disabled={shapeDraftPoints.length === 0}
              className="rounded-md border border-white/20 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-200 disabled:opacity-50"
            >
              Undo
            </button>
            <button
              onClick={cancelDrawingShape}
              className="rounded-md border border-white/20 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={finishDrawingShape}
              className="rounded-md border border-cyan-400/50 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-200"
            >
              Finish Shape
            </button>
          </div>
        </div>
      )}

      {analyzing && !showModal && (
        <div className="absolute bottom-10 left-1/2 z-30 -translate-x-1/2 flex items-center gap-3 rounded-full border border-[#14B8A6]/30 bg-black/80 px-6 py-3 text-sm text-[#14B8A6] backdrop-blur-md">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#14B8A6] border-t-transparent" />
          Analyzing conflicts...
        </div>
      )}
    </div>
  );
}

function getExistingLayerIds(
  mapRef: MapRef | null,
  layerIds: string[]
): string[] {
  if (!mapRef || layerIds.length === 0) return [];

  const map = mapRef.getMap();
  if (!map || !map.isStyleLoaded()) return [];

  return layerIds.filter((layerId) => Boolean(map.getLayer(layerId)));
}

function safeQueryRenderedFeatures(
  mapRef: MapRef | null,
  point: MapMouseEvent["point"],
  options?: { layers: string[] }
) {
  if (!mapRef) return [];
  try {
    return mapRef.queryRenderedFeatures(point, options);
  } catch {
    return [];
  }
}

function stringProp(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function formatDateTime(value: Date | null): string {
  if (!value) return "Never";
  return value.toLocaleString();
}

function firstHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(/https?:\/\/[^\s|;]+/i);
  return match ? match[0] : null;
}

function resolveBaseLayerId(layerId: string): string | null {
  if (!layerId || layerId.startsWith("project-")) return null;
  if (layerId.endsWith("-layer")) return layerId.slice(0, -"-layer".length);
  if (layerId.endsWith("-border")) return layerId.slice(0, -"-border".length);
  return layerId;
}

function parseProjectIdFromLayerId(layerId: string): string | null {
  if (!layerId.startsWith("project-")) return null;
  if (layerId === "project-circle-fill" || layerId === "project-circle-border") return null;

  if (layerId.endsWith("-fill")) {
    return layerId.slice("project-".length, -"-fill".length) || null;
  }
  if (layerId.endsWith("-border")) {
    return layerId.slice("project-".length, -"-border".length) || null;
  }
  return null;
}

function isLegacyProjectLayerId(layerId: string): boolean {
  return layerId === "project-circle-fill" || layerId === "project-circle-border";
}

function createProjectId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `project-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function fromStoredProject(project: StoredProjectRecord): ProjectRecord {
  return {
    id: project.id,
    lat: project.lat,
    lng: project.lng,
    config: {
      projectType: project.config.projectType,
      radiusKm: project.config.radiusKm,
      name: project.config.name,
      shapeType: project.config.shapeType,
    },
    analysisResult: project.analysisResult ?? null,
    customPolygon: sanitizePolygon(project.customPolygon),
  };
}

function toStoredProject(project: ProjectRecord): StoredProjectRecord {
  return {
    id: project.id,
    lat: project.lat,
    lng: project.lng,
    config: {
      projectType: project.config.projectType,
      radiusKm: project.config.radiusKm,
      name: project.config.name,
      shapeType: project.config.shapeType,
    },
    analysisResult: project.analysisResult ?? null,
    customPolygon: sanitizePolygon(project.customPolygon),
  };
}

function getProjectAnalysisInput(project: ProjectRecord): {
  lat: number;
  lng: number;
  radiusKm: number;
} {
  if (project.config.shapeType === "drawn" && project.customPolygon && project.customPolygon.length >= 4) {
    const centroid = polygonCentroid(project.customPolygon);
    const radiusKm = Math.max(1, estimateRadiusFromPolygonKm(project.customPolygon, centroid));
    return {
      lat: centroid[1],
      lng: centroid[0],
      radiusKm: Number(radiusKm.toFixed(1)),
    };
  }

  return {
    lat: project.lat,
    lng: project.lng,
    radiusKm: project.config.radiusKm,
  };
}

function createProjectAreaGeoJSON(project: ProjectRecord): GeoJSON.FeatureCollection | null {
  const properties: GeoJSON.GeoJsonProperties = {
    project_id: project.id,
    project_name: project.config.name,
    name: project.config.name,
  };

  const radiusKm = project.analysisResult?.project_circle.radius_km ?? project.config.radiusKm;

  if (project.config.shapeType === "drawn") {
    if (project.customPolygon && project.customPolygon.length >= 4) {
      return {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties,
            geometry: {
              type: "Polygon",
              coordinates: [closeRing(project.customPolygon)],
            },
          },
        ],
      };
    }
    return createCircleGeoJSON(project.lng, project.lat, radiusKm, properties);
  }

  if (project.config.shapeType === "square") {
    return createRegularPolygonGeoJSON(project.lng, project.lat, radiusKm, 4, properties, Math.PI / 4);
  }

  if (project.config.shapeType === "hexagon") {
    return createRegularPolygonGeoJSON(project.lng, project.lat, radiusKm, 6, properties);
  }

  return createCircleGeoJSON(project.lng, project.lat, radiusKm, properties);
}

function shiftPolygon(
  polygon: [number, number][],
  deltaLng: number,
  deltaLat: number
): [number, number][] {
  return polygon.map(([lng, lat]) => [lng + deltaLng, lat + deltaLat]);
}

function sanitizePolygon(
  polygon: [number, number][] | undefined
): [number, number][] | undefined {
  if (!polygon || polygon.length === 0) return undefined;
  const points = polygon
    .map((point) => [Number(point[0]), Number(point[1])] as [number, number])
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
  return points.length > 0 ? points : undefined;
}

function closeRing(points: [number, number][]): [number, number][] {
  if (points.length === 0) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return points;
  return [...points, first];
}

function polygonCentroid(points: [number, number][]): [number, number] {
  const ring = closeRing(points);
  const withoutClosure = ring.slice(0, -1);
  const count = withoutClosure.length;
  const lng = withoutClosure.reduce((sum, point) => sum + point[0], 0) / count;
  const lat = withoutClosure.reduce((sum, point) => sum + point[1], 0) / count;
  return [lng, lat];
}

function estimateRadiusFromPolygonKm(
  points: [number, number][],
  center: [number, number]
): number {
  const ring = closeRing(points).slice(0, -1);
  if (ring.length === 0) return 1;

  let maxDistance = 0;
  for (const [lng, lat] of ring) {
    const distance = haversineKm(center[0], center[1], lng, lat);
    if (distance > maxDistance) maxDistance = distance;
  }
  return maxDistance;
}

function haversineKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function createCircleGeoJSON(
  lng: number,
  lat: number,
  radiusKm: number,
  properties: GeoJSON.GeoJsonProperties = {},
  steps = 64
): GeoJSON.FeatureCollection {
  return createRegularPolygonGeoJSON(lng, lat, radiusKm, steps, properties);
}

function createRegularPolygonGeoJSON(
  lng: number,
  lat: number,
  radiusKm: number,
  sides: number,
  properties: GeoJSON.GeoJsonProperties = {},
  rotationRadians = 0
): GeoJSON.FeatureCollection {
  const coords: [number, number][] = [];
  const distRadians = radiusKm / 6371;

  for (let i = 0; i <= sides; i++) {
    const angle = (i / sides) * 2 * Math.PI + rotationRadians;
    const dLat = distRadians * Math.cos(angle);
    const dLng = distRadians * Math.sin(angle) / Math.cos((lat * Math.PI) / 180);
    coords.push([lng + (dLng * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties,
        geometry: { type: "Polygon", coordinates: [coords] },
      },
    ],
  };
}
