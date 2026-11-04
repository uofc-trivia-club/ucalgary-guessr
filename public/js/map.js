// public/js/map.js

// ArcGIS Maps SDK is loaded globally from the CDN in index.html.
let mapElement = null;
let Graphic = null;
let webMercatorUtils = null;
let Extent = null;
let guessGraphic = null;
let selectedBuildingGraphic = null;
let resultGraphics = [];
let resultLayerStates = null;
let resultViewPadding = null;
let resultViewpoint = null;
let guessAnchor = null;
let guessingEnabled = false;
let onGuessPlacedCallback = null;
let clickGeneration = 0;

const BUILDING_NAME_FIELDS = [
  "building_name",
  "buildingname",
  "bldg_name",
  "bldgname",
  "facility_name",
  "facilityname",
  "building",
  "facility",
  "display_name",
  "displayname",
  "label",
  "name",
  "title",
];

const BUILDING_ID_FIELDS = [
  "building_id",
  "buildingid",
  "bldg_id",
  "bldgid",
  "building_code",
  "buildingcode",
  "bldg_code",
  "bldgcode",
  "facility_id",
  "facilityid",
  "globalid",
  "objectid",
];

function pointGeometry({ latitude, longitude }) {
  return {
    type: "point",
    latitude,
    longitude,
    spatialReference: { wkid: 4326 },
  };
}

function removeGraphic(graphic) {
  if (mapElement && graphic) {
    mapElement.graphics.remove(graphic);
  }
}

function normaliseFieldName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function usableAttributeValue(value) {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return Boolean(text) && text !== "<Null>" && text !== "null";
}

function firstAttribute(attributes, preferredFields) {
  if (!attributes || typeof attributes !== "object") return null;

  const entries = Object.entries(attributes);
  for (const preferred of preferredFields) {
    const preferredNormalised = normaliseFieldName(preferred);
    const match = entries.find(([key, value]) =>
      normaliseFieldName(key) === preferredNormalised && usableAttributeValue(value)
    );
    if (match) return { field: match[0], value: String(match[1]).trim() };
  }

  return null;
}

function fieldAttribute(attributes, fieldName) {
  if (!attributes || !fieldName) return null;
  const target = normaliseFieldName(fieldName);
  const match = Object.entries(attributes).find(
    ([key, value]) => normaliseFieldName(key) === target && usableAttributeValue(value)
  );
  return match ? { field: match[0], value: String(match[1]).trim() } : null;
}

function resolvePopupTitle(graphic) {
  const attributes = graphic?.attributes || {};
  const template = graphic?.popupTemplate || graphic?.layer?.popupTemplate || null;
  const title = typeof template?.title === "string" ? template.title.trim() : "";
  if (!title) return null;

  const resolved = title.replace(/\{([^}:]+)(?::[^}]+)?\}/g, (_, fieldName) => {
    const match = fieldAttribute(attributes, fieldName);
    return match?.value || "";
  }).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  if (!resolved || /\{[^}]+\}/.test(resolved)) return null;
  return resolved;
}

function nameFromFieldMetadata(graphic) {
  const attributes = graphic?.attributes || {};
  const layer = graphic?.layer || null;
  const fields = Array.isArray(layer?.fields) ? layer.fields : [];

  const likelyNameField = fields.find((field) => {
    const descriptor = `${field?.name || ""} ${field?.alias || ""}`;
    return /building|bldg|facility|name|title|label/i.test(descriptor) &&
      fieldAttribute(attributes, field?.name);
  });

  if (!likelyNameField) return null;
  return fieldAttribute(attributes, likelyNameField.name);
}

function extractDisplayName(graphic) {
  const attributes = graphic?.attributes || {};
  const layer = graphic?.layer || null;

  // Prefer the layer's configured display field because this is normally the
  // same human-readable name ArcGIS uses in the original popup.
  const displayFieldMatch = fieldAttribute(attributes, layer?.displayField);
  if (displayFieldMatch) return displayFieldMatch;

  const preferredMatch = firstAttribute(attributes, BUILDING_NAME_FIELDS);
  if (preferredMatch) return preferredMatch;

  const metadataMatch = nameFromFieldMetadata(graphic);
  if (metadataMatch) return metadataMatch;

  const popupTitle = resolvePopupTitle(graphic);
  if (popupTitle) return { field: null, value: popupTitle };

  return null;
}

function looksBuildingSpecific(graphic) {
  const attributes = graphic?.attributes || {};
  const layer = graphic?.layer || null;
  const layerTitle = String(layer?.title || "");
  if (/building|bldg|facility/i.test(layerTitle)) return true;

  if (Object.keys(attributes).some((key) => /building|bldg|facility/i.test(key))) {
    return true;
  }

  const fields = Array.isArray(layer?.fields) ? layer.fields : [];
  return fields.some((field) =>
    /building|bldg|facility/i.test(`${field?.name || ""} ${field?.alias || ""}`)
  );
}

function extractBuildingInfo(graphic, { fromPopup = false } = {}) {
  if (!graphic || graphic.geometry?.type !== "polygon") return null;

  // Popup features are already the interactive features configured by the Web
  // Map. Do not reject them merely because the underlying layer has a generic
  // title such as "Campus" or its display field is simply "NAME".
  if (!fromPopup && !looksBuildingSpecific(graphic)) return null;

  const nameMatch = extractDisplayName(graphic);
  if (!nameMatch?.value) return null;

  const attributes = graphic.attributes || {};
  const layer = graphic.layer || null;
  const configuredIdField = layer?.globalIdField || layer?.objectIdField || null;
  const configuredId = fieldAttribute(attributes, configuredIdField);
  const idMatch = configuredId || firstAttribute(attributes, BUILDING_ID_FIELDS);
  const objectId = typeof graphic.getObjectId === "function" ? graphic.getObjectId() : null;
  const layerId = String(layer?.id || layer?.title || "buildings");

  return {
    id: idMatch?.value || (objectId !== null && objectId !== undefined
      ? `${layerId}:${objectId}`
      : `${layerId}:${nameMatch.value}`),
    name: nameMatch.value,
    layerId,
    graphic,
  };
}

function pointToLatLon(point) {
  if (!point) return null;

  if (Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) {
    return { latitude: point.latitude, longitude: point.longitude };
  }

  if (webMercatorUtils?.isWebMercator(point.spatialReference)) {
    const geographic = webMercatorUtils.webMercatorToGeographic(point);
    if (Number.isFinite(geographic?.latitude) && Number.isFinite(geographic?.longitude)) {
      return { latitude: geographic.latitude, longitude: geographic.longitude };
    }
  }

  if (Number.isFinite(point.y) && Number.isFinite(point.x) && point.spatialReference?.isGeographic) {
    return { latitude: point.y, longitude: point.x };
  }

  return null;
}

function geometryAnchor(geometry, fallbackPoint) {
  const candidate = geometry?.centroid || geometry?.extent?.center || fallbackPoint;
  return pointToLatLon(candidate) || pointToLatLon(fallbackPoint);
}

function clearBuildingSelection() {
  removeGraphic(selectedBuildingGraphic);
  selectedBuildingGraphic = null;
}

function placeGuessMarker(coords) {
  if (!mapElement || !Graphic) return;

  clearBuildingSelection();
  removeGraphic(guessGraphic);

  guessGraphic = new Graphic({
    geometry: pointGeometry(coords),
    symbol: {
      type: "simple-marker",
      style: "circle",
      size: 12,
      color: "#1677ff",
      outline: {
        color: "#ffffff",
        width: 2,
      },
    },
  });

  guessAnchor = pointGeometry(coords);
  mapElement.graphics.add(guessGraphic);
}

function selectBuilding(building, fallbackPoint) {
  if (!mapElement || !Graphic) return null;

  const anchor = geometryAnchor(building.graphic.geometry, fallbackPoint);
  if (!anchor) return null;

  removeGraphic(guessGraphic);
  guessGraphic = null;
  clearBuildingSelection();

  selectedBuildingGraphic = new Graphic({
    geometry: building.graphic.geometry,
    symbol: {
      type: "simple-fill",
      color: [22, 119, 255, 0.28],
      outline: {
        color: [22, 119, 255, 1],
        width: 3,
      },
    },
  });

  guessAnchor = pointGeometry(anchor);
  mapElement.graphics.add(selectedBuildingGraphic);

  return {
    type: "building",
    buildingId: building.id,
    buildingName: building.name,
    buildingLayerId: building.layerId,
    latitude: anchor.latitude,
    longitude: anchor.longitude,
  };
}

async function buildingFromPopupFeatures(event) {
  const screenPoint = event.detail?.screenPoint;
  if (!screenPoint || typeof mapElement?.fetchPopupFeatures !== "function") return null;

  const generator = await mapElement.fetchPopupFeatures(screenPoint, {
    pointerType: event.detail?.pointerType,
    defaultPopupTemplateEnabled: true,
  });

  for await (const feature of generator) {
    const building = extractBuildingInfo(feature, { fromPopup: true });
    if (building) return building;
  }

  return null;
}

async function buildingFromLayerViews(event) {
  if (typeof mapElement?.whenLayerView !== "function") return { building: null, complete: false };

  const layers = [];
  const popupLayers = [];
  let allPolygonSourcesCovered = true;
  mapElement.map?.allLayers?.forEach((layer) => {
    if (layer.visible === false || ["group", "vector-tile"].includes(layer.type)
        || (layer.geometryType && layer.geometryType !== "polygon")) return;
    const buildingLayer = looksBuildingSpecific({ layer });
    if (layer.type === "feature" && (buildingLayer || layer.popupEnabled !== false)) {
      // Preserve the priority of known buildings over generic popup polygons.
      (buildingLayer ? layers : popupLayers).push({ layer, fromPopup: !buildingLayer });
    } else {
      // Graphics and service sublayers can expose polygons through hit tests or
      // popups. An unqueried source prevents us from declaring an empty click.
      allPolygonSourcesCovered = false;
    }
  });
  layers.push(...popupLayers);

  // Query polygons already cached for drawing. ArcGIS's first GPU hit test can
  // take substantially longer, even when no network request is needed.
  let complete = layers.length > 0 && allPolygonSourcesCovered;
  const queriedViews = [];
  const cacheIsComplete = layerView => layerView.dataUpdating === false
    && (layerView.hasAllFeaturesInView === true || layerView.hasAllFeatures === true);
  const queriedCachesAreComplete = () => queriedViews.every(layerView => cacheIsComplete(layerView)
    && !layerView.suspended && layerView.visible !== false);
  for (const { layer, fromPopup } of layers) {
    // Do not let a generic popup polygon outrank a building that may still be
    // missing from the client cache. Keep the original GPU-first fallback then.
    if (fromPopup && (!complete || !queriedCachesAreComplete())) break;
    try {
      const layerView = await mapElement.whenLayerView(layer);
      if (layerView.suspended || layerView.visible === false) continue;
      if (typeof layerView.queryFeatures !== "function") {
        complete = false;
        continue;
      }
      const completeBeforeQuery = cacheIsComplete(layerView);
      const result = await layerView.queryFeatures({
        geometry: event.detail.mapPoint,
        spatialRelationship: "intersects",
        outFields: ["*"],
        returnGeometry: true,
      });
      queriedViews.push(layerView);
      complete = complete && completeBeforeQuery && cacheIsComplete(layerView);
      for (const feature of result.features || []) {
        const building = extractBuildingInfo(feature, { fromPopup });
        if (building && (!fromPopup || (complete && queriedCachesAreComplete()))) {
          return { building, complete };
        }
      }
      // Intersecting features without usable building attributes need the
      // existing fallback; they are not evidence that the ground is empty.
      if (!Array.isArray(result.features) || result.features.length) complete = false;
    } catch (error) {
      complete = false;
      console.warn("Cached building lookup failed; trying rendered features.", error);
    }
  }
  return { building: null, complete: complete && queriedViews.length > 0
    && queriedCachesAreComplete() };
}

async function buildingFromHitTest(event) {
  const hit = await mapElement.hitTest(event.detail, {
    exclude: [guessGraphic, selectedBuildingGraphic, ...resultGraphics].filter(Boolean),
  });
  for (const result of hit.results || []) {
    if (result?.type !== "graphic") continue;
    const building = extractBuildingInfo(result.graphic, { fromPopup: false });
    if (building) return building;
  }
  return null;
}

async function handleMapClick(event) {
  if (!guessingEnabled) return;

  const generation = ++clickGeneration;
  const point = event.detail?.mapPoint;
  if (!point) return;

  // Resolve rendered buildings before enabling submission. A temporary point
  // guess must not be submitted while the same click is becoming a building.
  let building = null;
  let cacheComplete = false;
  try {
    const cached = await buildingFromLayerViews(event);
    if (generation !== clickGeneration || !guessingEnabled) return;
    building = cached.building;
    cacheComplete = cached.complete;
    // A complete client-side miss already proves this is empty ground. Do not
    // stall point placement on a redundant GPU hit test or popup lookup.
    if (!building && !cacheComplete) building = await buildingFromHitTest(event);
  } catch (error) {
    console.warn("Local building lookup failed; trying popup features.", error);
  }
  if (generation !== clickGeneration || !guessingEnabled) return;

  if (building) {
    const guess = selectBuilding(building, point);
    if (guess && typeof onGuessPlacedCallback === "function") {
      onGuessPlacedCallback(guess);
    }
    return;
  }

  // Empty-map clicks remain responsive while remote popup features load.
  const coords = pointToLatLon(point);
  if (coords) {
    const pointGuess = { type: "point", ...coords };
    placeGuessMarker(pointGuess);

    if (typeof onGuessPlacedCallback === "function") {
      onGuessPlacedCallback(pointGuess);
    }
  }

  if (cacheComplete) return;

  try {
    building = await buildingFromPopupFeatures(event);
    if (generation !== clickGeneration || !guessingEnabled) return;

    if (!building) return;

    const guess = selectBuilding(building, point);
    if (guess && typeof onGuessPlacedCallback === "function") {
      onGuessPlacedCallback(guess);
    }
  } catch (error) {
    // The point guess has already been placed, so a feature-query failure does
    // not make the map feel unresponsive or discard the player's click.
    console.warn("Building lookup failed; keeping point guess.", error);
  }
}

export async function initMap(onGuessPlaced) {
  mapElement = document.getElementById("map");
  if (!mapElement) {
    throw new Error("ArcGIS map element not found");
  }

  onGuessPlacedCallback = onGuessPlaced;
  [Graphic, webMercatorUtils, Extent] = await Promise.all([
    $arcgis.import("@arcgis/core/Graphic.js"),
    $arcgis.import("@arcgis/core/geometry/support/webMercatorUtils.js"),
    $arcgis.import("@arcgis/core/geometry/Extent.js"),
  ]);
  await mapElement.viewOnReady();

  // Retain building names in the rendered layer's hit-test results so selecting
  // a building does not require a second request to populate popup attributes.
  mapElement.map?.allLayers?.forEach((layer) => {
    if (layer.type === "feature" && looksBuildingSpecific({ layer })) {
      layer.outFields = ["*"];
    }
  });

  mapElement.addEventListener("arcgisViewImmediateClick", handleMapClick);
}

export function setGuessingEnabled(enabled) {
  if (guessingEnabled !== Boolean(enabled)) clickGeneration += 1;
  guessingEnabled = Boolean(enabled);
}

export function clearGuessAndAnswer() {
  clickGeneration += 1;
  removeGraphic(guessGraphic);
  clearBuildingSelection();
  resultGraphics.forEach(removeGraphic);
  resultGraphics = [];
  if (resultLayerStates) {
    resultLayerStates.forEach(([layer, visible]) => { layer.visible = visible; });
    resultLayerStates = null;
  }
  if (resultViewPadding && mapElement?.view) {
    mapElement.view.padding = resultViewPadding;
    if (resultViewpoint) {
      mapElement.view.goTo(resultViewpoint, { animate: false }).catch(() => {});
    }
  }
  resultViewPadding = null;
  resultViewpoint = null;

  guessGraphic = null;
  guessAnchor = null;
}

function addResultGraphic(properties, atBottom = false) {
  const graphic = new Graphic(properties);
  resultGraphics.push(graphic);
  if (atBottom) mapElement.graphics.add(graphic, 0);
  else mapElement.graphics.add(graphic);
  return graphic;
}

async function resultBuildingGeometry(location) {
  if (!location?.buildingName) return null;
  const layers = [];
  mapElement.map?.allLayers?.forEach(layer => {
    if (layer.type === "feature" && looksBuildingSpecific({ layer }) &&
        (!layer.geometryType || layer.geometryType === "polygon")) layers.push(layer);
  });
  const nameKey = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const layer of layers) {
    if (typeof layer.queryFeatures !== "function") continue;
    try {
      const result = await layer.queryFeatures({
        geometry: pointGeometry(location),
        spatialRelationship: "intersects",
        outFields: ["*"],
        returnGeometry: true,
        outSpatialReference: { wkid: 4326 },
      });
      const match = result.features?.find(feature => {
        const info = extractBuildingInfo(feature, { fromPopup: true });
        return info && nameKey(info.name) === nameKey(location.buildingName);
      });
      if (match) return match.geometry;
    } catch (error) {
      // The result markers still work if the building service is unavailable.
      console.warn("Could not load a result building outline.", error);
    }
  }
  return null;
}

async function frameResultLocations(locations, geometries, generation) {
  if (generation !== clickGeneration || typeof mapElement.view?.goTo !== "function") return;
  const coordinates = locations.map(({ location }) => [location.longitude, location.latitude]);
  for (const geometry of geometries) {
    const bounds = geometry?.extent;
    if (bounds?.spatialReference?.wkid === 4326) {
      coordinates.push([bounds.xmin, bounds.ymin], [bounds.xmax, bounds.ymax]);
    }
  }
  const xs = coordinates.map(point => point[0]);
  const ys = coordinates.map(point => point[1]);
  const xPad = Math.max((Math.max(...xs) - Math.min(...xs)) * 0.35, 0.0012);
  const yPad = Math.max((Math.max(...ys) - Math.min(...ys)) * 0.35, 0.0009);
  const legend = document.getElementById("map-result-summary");
  const legendHeight = legend?.hidden ? 0 : legend?.getBoundingClientRect?.().height || 48;
  mapElement.view.padding = { ...resultViewPadding,
    bottom: Math.max(resultViewPadding?.bottom || 0,
      Math.min(legendHeight + 16, Math.max(0, (mapElement.clientHeight || 400) - 80))) };
  try {
    await mapElement.view.goTo(new Extent({
      xmin: Math.min(...xs) - xPad, xmax: Math.max(...xs) + xPad,
      ymin: Math.min(...ys) - yPad, ymax: Math.max(...ys) + yPad,
      spatialReference: { wkid: 4326 },
    }), { animate: false });
  } catch (error) {
    if (error.name !== "AbortError") console.warn("Could not frame the result map.", error);
  }
}

export async function showAnswerOnMap(answer, guess = null) {
  if (!mapElement || !Graphic || !answer) return;
  const restoredGuess = guess || (guessAnchor ? { type: "point", ...guessAnchor } : null);
  clearGuessAndAnswer();
  setGuessingEnabled(false);
  const generation = clickGeneration;
  // Hide operational overlays only; the basemap remains as geographic context.
  resultLayerStates = [];
  (mapElement.map?.layers || mapElement.map?.allLayers)?.forEach(layer => {
    resultLayerStates.push([layer, layer.visible]);
    layer.visible = false;
  });
  if (mapElement.view) {
    const padding = mapElement.view.padding;
    resultViewPadding = { top: padding?.top || 0, right: padding?.right || 0,
      bottom: padding?.bottom || 0, left: padding?.left || 0 };
    resultViewpoint = mapElement.view.viewpoint?.clone?.() || null;
  }

  const blue = "#2563eb";
  const green = "#15803d";
  const sameLocation = restoredGuess && Math.abs(restoredGuess.latitude - answer.latitude) < 1e-8 &&
    Math.abs(restoredGuess.longitude - answer.longitude) < 1e-8;
  if (restoredGuess && !sameLocation) {
    addResultGraphic({
      geometry: {
        type: "polyline",
        paths: [[
          [restoredGuess.longitude, restoredGuess.latitude],
          [answer.longitude, answer.latitude],
        ]],
        spatialReference: { wkid: 4326 },
      },
      symbol: { type: "simple-line", color: "#475569", width: 2, style: "short-dash" },
    });
  }
  const locations = [
    ...(restoredGuess && !sameLocation ? [{ location: restoredGuess, role: "guess", color: blue, label: "Your guess", yoffset: -26 }] : []),
    { location: answer, role: "answer", color: green, label: sameLocation ? "Exact match · 0 m" : "Correct", yoffset: 24 },
  ];
  for (const { location, role, color, label, yoffset } of locations) {
    addResultGraphic({
      geometry: pointGeometry(location),
      attributes: { resultRole: role },
      symbol: { type: "simple-marker", style: role === "answer" ? "diamond" : "circle",
        size: sameLocation && role === "guess" ? 20 : 14, color,
        outline: { color: "#ffffff", width: 2 } },
    });
    if (!sameLocation || role === "answer") {
      addResultGraphic({
        geometry: pointGeometry(location),
        attributes: { resultRole: `${role}-label` },
        symbol: { type: "text", text: label, color, haloColor: "#ffffff", haloSize: 2,
          yoffset, font: { family: "Inter", size: 11, weight: "bold" } },
      });
    }
  }

  await frameResultLocations(locations, [], generation);
  if (generation !== clickGeneration) return;

  const geometries = await Promise.all(locations.map(({ location, role }) =>
    sameLocation && role === "guess" ? null : resultBuildingGeometry(location)));
  if (generation !== clickGeneration) return;
  geometries.forEach((geometry, index) => {
    if (!geometry) return;
    const { role, color } = locations[index];
    addResultGraphic({ geometry, attributes: { resultRole: role },
      symbol: { type: "simple-fill", color: role === "answer" ? [21, 128, 61, 0.28] : [37, 99, 235, 0.18],
        outline: { color, width: 3 } } }, true);
  });

  await frameResultLocations(locations, geometries, generation);
}
