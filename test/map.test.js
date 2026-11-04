import test from "node:test";
import assert from "node:assert/strict";

// Replace only the external SDK and DOM boundary. Exercise the actual map
// controller and its real event registration, selection, and race handling.
async function setup(t, layers = []) {
  const graphics = [];
  const host = new EventTarget();
  host.map = { allLayers: layers };
  host.graphics = {
    add: (graphic) => graphics.push(graphic),
    remove: (graphic) => {
      const index = graphics.indexOf(graphic);
      if (index >= 0) graphics.splice(index, 1);
    },
  };
  host.viewOnReady = async () => {};
  host.hitTest = async () => ({ results: [] });
  host.fetchPopupFeatures = async () => (async function* () {})();
  const saved = { document: globalThis.document, sdk: globalThis.$arcgis };
  globalThis.document = { getElementById: () => host };
  globalThis.$arcgis = {
    import: async (name) => name.endsWith("Graphic.js") || name.endsWith("Extent.js")
      ? class { constructor(properties) { Object.assign(this, properties); } }
      : { isWebMercator: () => false },
  };
  t.after(() => {
    if (saved.document === undefined) delete globalThis.document;
    else globalThis.document = saved.document;
    if (saved.sdk === undefined) delete globalThis.$arcgis;
    else globalThis.$arcgis = saved.sdk;
  });
  const map = await import(`../public/js/map.js?test=${t.name}`);
  const guesses = [];
  await map.initMap((guess) => guesses.push(guess));
  map.setGuessingEnabled(true);
  return { map, host, graphics, guesses };
}

function building(name = "Administration", title = "Buildings") {
  return {
    geometry: { type: "polygon", centroid: { latitude: 51.07817, longitude: -114.12715 } },
    attributes: { OBJECTID: 12, BuildingName: name, BLD_ID: "AD" },
    layer: { id: "UC_Buildings_7448", title, displayField: "BuildingName", objectIdField: "OBJECTID" },
  };
}

function click(host, longitude = -114.128) {
  const event = new Event("arcgisViewImmediateClick");
  event.detail = { x: 100, y: 100, screenPoint: { x: 100, y: 100 },
    mapPoint: { latitude: 51.078, longitude }, pointerType: "mouse" };
  host.dispatchEvent(event);
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("result maps hide unrelated overlays, restore both locations, and highlight the correct polygon", async (t) => {
  const correct = building("MacEwan Hall");
  correct.layer.type = "feature";
  correct.layer.visible = true;
  correct.geometry.centroid = { latitude: 51.080, longitude: -114.130 };
  correct.layer.queryFeatures = async () => ({ features: [correct] });
  const pointsOfInterest = { title: "Points of Interest", type: "feature", visible: true };
  const alreadyHidden = { title: "Parking", type: "feature", visible: false };
  const { host, map, graphics } = await setup(t, [correct.layer, pointsOfInterest, alreadyHidden]);
  const frames = [];
  // ArcGIS exposes Padding through Accessor getters, not enumerable own fields.
  host.view = { padding: Object.create({ top: 3, right: 7, bottom: 4, left: 5 }), goTo: async target => frames.push(target) };
  const guess = { type: "point", latitude: 51.078, longitude: -114.128 };
  const answer = { type: "building", buildingName: "MacEwan Hall", latitude: 51.080, longitude: -114.130 };
  await map.showAnswerOnMap(answer, guess);
  assert.equal(pointsOfInterest.visible, false);
  assert.equal(correct.layer.visible, false, "Original orange building layer is hidden");
  assert.ok(graphics.some(graphic => graphic.geometry.type === "polygon" && graphic.attributes?.resultRole === "answer"));
  assert.ok(graphics.some(graphic => graphic.attributes?.resultRole === "guess" && graphic.geometry.longitude === guess.longitude));
  assert.ok(graphics.some(graphic => graphic.attributes?.resultRole === "answer" && graphic.geometry.longitude === answer.longitude));
  assert.ok(graphics.some(graphic => graphic.geometry.type === "polyline"));
  assert.ok(frames.length > 0, "Both locations are framed automatically");
  assert.equal(host.view.padding.top, 3);
  assert.equal(host.view.padding.right, 7);
  const bounds = frames.at(-1);
  assert.ok(bounds.xmin < -114.130 && bounds.xmax > -114.128);
  assert.ok(bounds.ymin < 51.078 && bounds.ymax > 51.080);
  map.clearGuessAndAnswer();
  assert.equal(graphics.length, 0);
  assert.equal(pointsOfInterest.visible, true);
  assert.equal(correct.layer.visible, true);
  assert.equal(alreadyHidden.visible, false);
  assert.equal(host.view.padding.bottom, 4);
});

test("a late result polygon cannot reappear after the next photo starts", async (t) => {
  const feature = building();
  feature.layer.type = "feature";
  feature.layer.visible = true;
  let finish;
  feature.layer.queryFeatures = () => new Promise(resolve => { finish = resolve; });
  const { map, host, graphics } = await setup(t, [feature.layer]);
  const frames = [];
  host.view = { padding: {}, goTo: async target => frames.push(target) };
  const result = map.showAnswerOnMap({ type: "building", buildingName: "Administration", latitude: 51.07817, longitude: -114.12715 });
  await settle();
  assert.equal(typeof finish, "function", "The result requests the correct building polygon");
  assert.equal(frames.length, 1, "Frame result markers before waiting for the outline service");
  map.clearGuessAndAnswer();
  finish?.({ features: [feature] });
  await result;
  assert.equal(graphics.length, 0);
  assert.equal(feature.layer.visible, true);
});

test("correct guesses share one outline and use one clear map label", async (t) => {
  const feature = building();
  feature.layer.type = "feature";
  feature.layer.queryFeatures = async () => ({ features: [feature] });
  const { map, graphics } = await setup(t, [feature.layer]);
  const location = { type: "building", buildingName: "Administration", latitude: 51.07817, longitude: -114.12715 };
  await map.showAnswerOnMap(location, location);
  assert.equal(graphics.filter(graphic => graphic.geometry.type === "polygon").length, 1);
  assert.equal(graphics.filter(graphic => graphic.symbol.type === "simple-marker").length, 1);
  assert.equal(graphics.filter(graphic => graphic.geometry.type === "polyline").length, 0);
  assert.deepEqual(graphics.filter(graphic => graphic.symbol.type === "text").map(graphic => graphic.symbol.text), ["Exact match · 0 m"]);
});

test("result markers and camera framing still work when polygon lookup fails", async (t) => {
  t.mock.method(console, "warn", () => {});
  const layer = { title: "Buildings", type: "feature", queryFeatures: async () => { throw new Error("Offline"); } };
  const { map, host, graphics } = await setup(t, [layer]);
  let framed = false;
  host.view = { padding: {}, goTo: async () => { framed = true; } };
  await map.showAnswerOnMap({ type: "building", buildingName: "Administration", latitude: 51.07817, longitude: -114.12715 });
  assert.ok(graphics.some(graphic => graphic.attributes?.resultRole === "answer"));
  assert.equal(framed, true);
});

test("rendered building polygons are selected without waiting for GPU hit testing", async (t) => {
  const feature = building();
  feature.layer.type = "feature";
  const { host, guesses } = await setup(t, [feature.layer]);
  assert.deepEqual(feature.layer.outFields, ["*"]);
  host.whenLayerView = async (layer) => {
    assert.equal(layer, feature.layer);
    return { queryFeatures: async (query) => {
      assert.equal(query.spatialRelationship, "intersects");
      assert.equal(query.geometry.longitude, -114.128);
      assert.equal(query.returnGeometry, true);
      return { features: [feature] };
    } };
  };
  host.hitTest = async () => { throw new Error("A cached building must not need GPU hit testing"); };
  host.fetchPopupFeatures = async () => { throw new Error("A cached building must not need remote lookup"); };
  click(host);
  await settle();
  assert.equal(guesses.length, 1);
  assert.equal(guesses[0].buildingName, "Administration");
});

test("the first immediate click selects a building without a provisional point guess", async (t) => {
  const { host, guesses, graphics } = await setup(t);
  host.hitTest = async () => ({ results: [{ type: "graphic", graphic: building() }] });
  host.fetchPopupFeatures = async () => { throw new Error("Local building selection must not require a popup query"); };
  click(host);
  await settle();
  assert.equal(guesses.length, 1);
  assert.equal(guesses[0].type, "building");
  assert.equal(guesses[0].buildingName, "Administration");
  assert.equal(guesses[0].latitude, 51.07817);
  assert.equal(graphics[0].geometry.type, "polygon");
});

test("an empty map click still places a point while a popup query is pending", async (t) => {
  const { host, guesses } = await setup(t);
  host.fetchPopupFeatures = () => new Promise(() => {});
  click(host);
  await settle();
  assert.deepEqual(guesses, [{ type: "point", latitude: 51.078, longitude: -114.128 }]);
});

test("switching from a building to empty cached ground does not wait for a GPU hit test", async (t) => {
  const feature = building();
  feature.layer.type = "feature";
  const { host, guesses, graphics } = await setup(t, [feature.layer]);
  host.whenLayerView = async () => ({
    hasAllFeaturesInView: true,
    dataUpdating: false,
    queryFeatures: async query => ({
      features: query.geometry.longitude === -114.128 ? [feature] : [],
    }),
  });
  let hitTests = 0;
  let popupQueries = 0;
  host.hitTest = () => { hitTests++; return new Promise(() => {}); };
  host.fetchPopupFeatures = () => { popupQueries++; return new Promise(() => {}); };
  click(host);
  await settle();
  assert.equal(guesses[0].type, "building");

  click(host, -114.130);
  await settle();
  assert.equal(guesses.length, 2, "Empty-ground selection must finish while GPU lookup is stalled");
  assert.deepEqual(guesses[1], { type: "point", latitude: 51.078, longitude: -114.130 });
  assert.deepEqual(graphics.map(graphic => graphic.geometry.type), ["point"]);
  assert.equal(hitTests, 0);
  assert.equal(popupQueries, 0);

  click(host);
  await settle();
  assert.equal(guesses[2].type, "building", "The next building selection remains usable");
});

for (const state of [
  { hasAllFeaturesInView: false, dataUpdating: false },
  { hasAllFeaturesInView: true, dataUpdating: true },
  { hasAllFeaturesInView: true },
]) {
  test(`an incomplete or updating cache still checks rendered buildings (${JSON.stringify(state)})`, async t => {
    const feature = building();
    feature.layer.type = "feature";
    const { host, guesses } = await setup(t, [feature.layer]);
    host.whenLayerView = async () => ({ ...state, queryFeatures: async () => ({ features: [] }) });
    host.hitTest = async () => ({ results: [{ type: "graphic", graphic: feature }] });
    click(host);
    await settle();
    assert.deepEqual(guesses.map(guess => guess.type), ["building"]);
  });
}

test("all visible building caches must be checked before accepting empty ground", async t => {
  const feature = building();
  feature.layer.type = "feature";
  const otherLayer = { title: "Other Buildings", type: "feature" };
  const { host, guesses } = await setup(t, [otherLayer, feature.layer]);
  host.whenLayerView = async layer => ({
    hasAllFeaturesInView: true, dataUpdating: false,
    queryFeatures: async () => ({ features: layer === feature.layer ? [feature] : [] }),
  });
  host.hitTest = () => new Promise(() => {});
  click(host);
  await settle();
  assert.deepEqual(guesses.map(guess => guess.type), ["building"]);
});

test("a complete empty cache cannot hide a building from another incomplete layer", async t => {
  const feature = building();
  feature.layer.type = "feature";
  const completeLayer = { title: "Other Buildings", type: "feature" };
  const { host, guesses } = await setup(t, [completeLayer, feature.layer]);
  host.whenLayerView = async layer => ({
    hasAllFeaturesInView: layer === completeLayer, dataUpdating: false,
    queryFeatures: async () => ({ features: [] }),
  });
  host.hitTest = async () => ({ results: [{ type: "graphic", graphic: feature }] });
  click(host);
  await settle();
  assert.deepEqual(guesses.map(guess => guess.type), ["building"]);
});

test("a complete Buildings cache cannot hide a generic Campus polygon", async t => {
  const knownLayer = { title: "Buildings", type: "feature", geometryType: "polygon" };
  const feature = building("Campus building", "Campus");
  Object.assign(feature.layer, { type: "feature", geometryType: "polygon", popupEnabled: true });
  const { host, guesses } = await setup(t, [knownLayer, feature.layer]);
  host.whenLayerView = async layer => ({
    hasAllFeaturesInView: true, dataUpdating: false,
    queryFeatures: async () => ({ features: layer === feature.layer ? [feature] : [] }),
  });
  host.hitTest = () => new Promise(() => {});
  click(host);
  await settle();
  assert.deepEqual(guesses.map(guess => guess.type), ["building"]);
  assert.equal(guesses[0].buildingName, "Campus building");
});

test("an incomplete Buildings cache keeps GPU building priority over generic popup polygons", async t => {
  const known = building();
  Object.assign(known.layer, { type: "feature", geometryType: "polygon" });
  const generic = building("Construction Area", "Campus");
  Object.assign(generic.layer, { type: "feature", geometryType: "polygon", popupEnabled: true });
  const { host, guesses } = await setup(t, [known.layer, generic.layer]);
  host.whenLayerView = async layer => ({
    hasAllFeaturesInView: layer !== known.layer, dataUpdating: false,
    queryFeatures: async () => ({ features: layer === generic.layer ? [generic] : [] }),
  });
  host.hitTest = async () => ({ results: [{ type: "graphic", graphic: known }] });
  click(host);
  await settle();
  assert.deepEqual(guesses.map(guess => guess.buildingName), ["Administration"]);
});

test("a generic cached polygon cannot bypass a building cache that starts updating", async t => {
  const known = building();
  Object.assign(known.layer, { type: "feature", geometryType: "polygon" });
  const generic = building("Construction Area", "Campus");
  Object.assign(generic.layer, { type: "feature", geometryType: "polygon", popupEnabled: true });
  const { host, guesses } = await setup(t, [known.layer, generic.layer]);
  const knownView = {
    hasAllFeaturesInView: true, dataUpdating: false, queryFeatures: async () => ({ features: [] }),
  };
  host.whenLayerView = async layer => layer === known.layer ? knownView : {
    hasAllFeaturesInView: true, dataUpdating: false,
    queryFeatures: async () => { knownView.dataUpdating = true; return { features: [generic] }; },
  };
  host.hitTest = async () => ({ results: [{ type: "graphic", graphic: known }] });
  click(host);
  await settle();
  assert.deepEqual(guesses.map(guess => guess.buildingName), ["Administration"]);
});

for (const type of ["graphics", "geojson", "map-image", "tile"]) {
  test(`a complete Buildings cache preserves the fallback for a ${type} popup polygon`, async t => {
    const knownLayer = { title: "Buildings", type: "feature", geometryType: "polygon" };
    const genericLayer = { title: "Campus", type, geometryType: "polygon", popupEnabled: true };
    const { host, guesses } = await setup(t, [knownLayer, genericLayer]);
    host.whenLayerView = async () => ({
      hasAllFeaturesInView: true, dataUpdating: false, queryFeatures: async () => ({ features: [] }),
    });
    host.fetchPopupFeatures = async () => (async function* () { yield building("Campus building", "Campus"); })();
    click(host);
    await settle();
    assert.deepEqual(guesses.map(guess => guess.type), ["point", "building"]);
  });
}

test("an earlier cache becoming incomplete prevents an authoritative empty result", async t => {
  const first = { title: "First Buildings", type: "feature" };
  const second = { title: "Second Buildings", type: "feature" };
  const { host, guesses } = await setup(t, [first, second]);
  const firstView = {
    hasAllFeaturesInView: true, dataUpdating: false, queryFeatures: async () => ({ features: [] }),
  };
  host.whenLayerView = async layer => layer === first ? firstView : {
    hasAllFeaturesInView: true, dataUpdating: false,
    queryFeatures: async () => { firstView.dataUpdating = true; return { features: [] }; },
  };
  host.hitTest = async () => ({ results: [{ type: "graphic", graphic: building() }] });
  click(host);
  await settle();
  assert.deepEqual(guesses.map(guess => guess.type), ["building"]);
});

test("cached polygons without names still use the rendered building fallback", async t => {
  const feature = building();
  feature.layer.type = "feature";
  const { host, guesses } = await setup(t, [feature.layer]);
  host.whenLayerView = async () => ({
    hasAllFeaturesInView: true, dataUpdating: false,
    queryFeatures: async () => ({ features: [{ ...feature, attributes: { OBJECTID: 12 } }] }),
  });
  host.hitTest = async () => ({ results: [{ type: "graphic", graphic: feature }] });
  click(host);
  await settle();
  assert.deepEqual(guesses.map(guess => guess.type), ["building"]);
});

test("a superseded cached miss cannot start another GPU lookup", async t => {
  const feature = building();
  feature.layer.type = "feature";
  const { host, guesses } = await setup(t, [feature.layer]);
  let finishOldQuery;
  host.whenLayerView = async () => ({
    queryFeatures: query => query.geometry.longitude === -114.128
      ? new Promise(resolve => { finishOldQuery = resolve; })
      : Promise.resolve({ features: [feature] }),
  });
  let hitTests = 0;
  host.hitTest = async () => { hitTests++; return { results: [] }; };
  click(host);
  await settle();
  click(host, -114.130);
  await settle();
  finishOldQuery({ features: [] });
  await settle();
  assert.equal(hitTests, 0);
  assert.deepEqual(guesses.map(guess => guess.type), ["building"]);
});

test("popup features can still upgrade a point when local building data is unavailable", async (t) => {
  const { host, guesses, graphics } = await setup(t);
  host.fetchPopupFeatures = async () => (async function* () { yield building("Administration", "Campus"); })();
  click(host);
  await settle();
  assert.deepEqual(guesses.map((guess) => guess.type), ["point", "building"]);
  assert.equal(guesses[1].buildingName, "Administration");
  assert.deepEqual(graphics.map((graphic) => graphic.geometry.type), ["polygon"]);
});

test("selected graphics are excluded from later rendered hit tests", async (t) => {
  const { host, guesses, graphics } = await setup(t);
  host.hitTest = async () => ({ results: [{ type: "graphic", graphic: building() }] });
  click(host);
  await settle();
  const highlight = graphics[0];
  host.hitTest = async (_, options) => {
    assert.deepEqual(options.exclude, [highlight]);
    return { results: [] };
  };
  click(host, -114.130);
  await settle();
  assert.equal(guesses[1].type, "point");
  assert.equal(graphics[0].geometry.type, "point");
});

test("a suspended building layer is not selected from its cached polygons", async (t) => {
  const feature = building();
  feature.layer.type = "feature";
  const { host, guesses } = await setup(t, [feature.layer]);
  let queried = false;
  host.whenLayerView = async () => ({ suspended: true, queryFeatures: async () => {
    queried = true;
    return { features: [feature] };
  } });
  click(host);
  await settle();
  assert.equal(queried, false);
  assert.equal(guesses[0].type, "point");
});

test("clearing the map invalidates a pending building lookup", async (t) => {
  const { host, map, guesses, graphics } = await setup(t);
  let resolve;
  host.hitTest = () => new Promise((done) => { resolve = done; });
  click(host);
  map.clearGuessAndAnswer();
  resolve?.({ results: [{ type: "graphic", graphic: building() }] });
  await settle();
  assert.equal(guesses.length, 0);
  assert.equal(graphics.length, 0);
});

test("clearing the map also invalidates a pending cached polygon query", async (t) => {
  const feature = building();
  feature.layer.type = "feature";
  const { host, map, guesses, graphics } = await setup(t, [feature.layer]);
  let resolve;
  host.whenLayerView = async () => ({ queryFeatures: () => new Promise((done) => { resolve = done; }) });
  click(host);
  await settle();
  map.clearGuessAndAnswer();
  resolve({ features: [feature] });
  await settle();
  assert.equal(guesses.length, 0);
  assert.equal(graphics.length, 0);
});

test("disabling and re-enabling guesses invalidates the previous click", async (t) => {
  const { host, map, guesses } = await setup(t);
  let resolve;
  host.hitTest = () => new Promise((done) => { resolve = done; });
  click(host);
  map.setGuessingEnabled(false);
  map.setGuessingEnabled(true);
  resolve?.({ results: [{ type: "graphic", graphic: building() }] });
  await settle();
  assert.equal(guesses.length, 0);
});

test("the latest click wins when local hit tests finish out of order", async (t) => {
  const { host, guesses } = await setup(t);
  let resolve;
  host.hitTest = () => new Promise((done) => { resolve = done; });
  click(host);
  host.hitTest = async () => ({ results: [{ type: "graphic", graphic: building("Mathison Hall") }] });
  click(host, -114.130);
  await settle();
  resolve?.({ results: [{ type: "graphic", graphic: building() }] });
  await settle();
  assert.equal(guesses.length, 1);
  assert.equal(guesses[0].buildingName, "Mathison Hall");
});
