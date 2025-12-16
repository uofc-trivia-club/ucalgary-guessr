// public/js/map.js

// Leaflet is loaded globally via <script> in index.html
let mapInstance = null;
let guessMarker = null;
let answerMarker = null;
let lineLayer = null;

// Match ucalgary-campus.png dimensions
const IMAGE_WIDTH = 1140;
const IMAGE_HEIGHT = 641;

let imageBounds = null;

function latLngToXY(latlng) {
  return {
    x: latlng.lng,
    y: latlng.lat,
  };
}

function xyToLatLng(x, y) {
  return L.latLng(y, x);
}

// Callback that receives { x, y } in image coordinates
export function initMap(onGuessPlaced) {
  const southWest = L.latLng(0, 0);
  const northEast = L.latLng(IMAGE_HEIGHT, IMAGE_WIDTH);
  const bounds = L.latLngBounds(southWest, northEast);

  imageBounds = bounds;

  mapInstance = L.map("map", {
    crs: L.CRS.Simple,
    minZoom: -1,
    maxZoom: 2,
  });

  const imageUrl = "/assets/maps/ucalgary-campus.png";
  L.imageOverlay(imageUrl, bounds).addTo(mapInstance);

  mapInstance.fitBounds(bounds);

  mapInstance.on("click", (e) => {
    placeGuessMarker(e.latlng);
    if (typeof onGuessPlaced === "function") {
      const xy = latLngToXY(e.latlng);
      onGuessPlaced(xy);
    }
  });
}

function placeGuessMarker(latlng) {
  if (!mapInstance) return;

  if (!guessMarker) {
    guessMarker = L.marker(latlng).addTo(mapInstance);
  } else {
    guessMarker.setLatLng(latlng);
  }
}

export function clearGuessAndAnswer() {
  if (mapInstance) {
    if (guessMarker) {
      mapInstance.removeLayer(guessMarker);
    }
    if (answerMarker) {
      mapInstance.removeLayer(answerMarker);
    }
    if (lineLayer) {
      mapInstance.removeLayer(lineLayer);
    }
  }

  guessMarker = null;
  answerMarker = null;
  lineLayer = null;
}

export function showAnswerOnMap(answer) {
  // answer is { x, y } in image coordinates
  if (!mapInstance || !answer) return;

  const answerLatLng = xyToLatLng(answer.x, answer.y);

  if (!answerMarker) {
    answerMarker = L.marker(answerLatLng).addTo(mapInstance);
  } else {
    answerMarker.setLatLng(answerLatLng);
  }

  if (guessMarker) {
    if (lineLayer) {
      mapInstance.removeLayer(lineLayer);
    }
    lineLayer = L.polyline(
      [guessMarker.getLatLng(), answerLatLng],
      {}
    ).addTo(mapInstance);
  }
}

export function invalidateMapSize() {
  if (mapInstance) {
    mapInstance.invalidateSize();
    if (imageBounds) {
      mapInstance.fitBounds(imageBounds);
    }
  }
}
