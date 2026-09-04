// public/js/map.js

// Leaflet is loaded globally
// via <script> in index.html.
let mapInstance = null;
let guessMarker = null;
let answerMarker = null;
let lineLayer = null;

// Match ucalgary-campus.png dimensions.
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
  return L.latLng(
    y,
    x
  );
}

function makeMarkerIcon(
  className
) {
  return L.divIcon({
    className: "",

    html:
      `<div class="${className}"></div>`,

    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

// Callback receives { x, y }
// in image coordinates.
export function initMap(
  onGuessPlaced
) {
  const southWest =
    L.latLng(0, 0);

  const northEast =
    L.latLng(
      IMAGE_HEIGHT,
      IMAGE_WIDTH
    );

  const bounds =
    L.latLngBounds(
      southWest,
      northEast
    );

  imageBounds = bounds;

  mapInstance =
    L.map("map", {
      crs: L.CRS.Simple,
      minZoom: -1,
      maxZoom: 2,
      zoomControl: true,
      attributionControl: true,
    });

  const imageUrl =
    "/assets/maps/ucalgary-campus.png";

  L.imageOverlay(
    imageUrl,
    bounds
  ).addTo(mapInstance);

  mapInstance.fitBounds(
    bounds
  );

  mapInstance.on(
    "click",
    (e) => {
      placeGuessMarker(
        e.latlng
      );

      if (
        typeof onGuessPlaced ===
        "function"
      ) {
        const xy =
          latLngToXY(
            e.latlng
          );

        onGuessPlaced(xy);
      }
    }
  );

  // Leaflet can initialise before
  // CSS layout has fully settled.
  requestAnimationFrame(() => {
    mapInstance.invalidateSize();

    mapInstance.fitBounds(
      bounds
    );
  });
}

function placeGuessMarker(
  latlng
) {
  if (!mapInstance) {
    return;
  }

  if (!guessMarker) {
    guessMarker =
      L.marker(
        latlng,
        {
          icon:
            makeMarkerIcon(
              "guess-marker"
            ),
        }
      ).addTo(
        mapInstance
      );
  } else {
    guessMarker.setLatLng(
      latlng
    );
  }
}

export function clearGuessAndAnswer() {
  if (mapInstance) {
    if (guessMarker) {
      mapInstance.removeLayer(
        guessMarker
      );
    }

    if (answerMarker) {
      mapInstance.removeLayer(
        answerMarker
      );
    }

    if (lineLayer) {
      mapInstance.removeLayer(
        lineLayer
      );
    }
  }

  guessMarker = null;
  answerMarker = null;
  lineLayer = null;
}

export function showAnswerOnMap(
  answer
) {
  // answer is { x, y }
  // in image coordinates.
  if (
    !mapInstance ||
    !answer
  ) {
    return;
  }

  const answerLatLng =
    xyToLatLng(
      answer.x,
      answer.y
    );

  if (!answerMarker) {
    answerMarker =
      L.marker(
        answerLatLng,
        {
          icon:
            makeMarkerIcon(
              "answer-marker"
            ),
        }
      ).addTo(
        mapInstance
      );
  } else {
    answerMarker.setLatLng(
      answerLatLng
    );
  }

  if (guessMarker) {
    if (lineLayer) {
      mapInstance.removeLayer(
        lineLayer
      );
    }

    lineLayer =
      L.polyline(
        [
          guessMarker.getLatLng(),
          answerLatLng,
        ],
        {
          color: "#c8102e",
          weight: 3,
          opacity: 0.82,
          dashArray: "8 8",
        }
      ).addTo(
        mapInstance
      );
  }
}

export function invalidateMapSize() {
  if (!mapInstance) {
    return;
  }

  mapInstance.invalidateSize();

  if (imageBounds) {
    mapInstance.fitBounds(
      imageBounds
    );
  }
}