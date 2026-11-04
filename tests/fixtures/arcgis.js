// Replace only the external SDK; application modules and API stay real.
class Graphic {
  constructor(properties) { Object.assign(this, properties); }
}
class ArcgisMap extends HTMLElement {
  constructor() {
    super();
    this.graphics = {
      items: [],
      add(graphic, index = this.items.length) { this.items.splice(index, 0, graphic); },
      remove(graphic) { this.items = this.items.filter((item) => item !== graphic); },
    };
    this.buildingLayer = { id: "UC_Buildings_7448", title: "Buildings", type: "feature", visible: true,
      displayField: "BuildingName", objectIdField: "OBJECTID", outFields: ["OBJECTID"] };
    const overlays = [this.buildingLayer, { title: "Points of Interest", type: "feature", visible: true }];
    this.map = { layers: overlays, allLayers: overlays };
    this.features = [{ type: "graphic", graphic: {
      geometry: { type: "polygon", centroid: { latitude: 51.07817, longitude: -114.12715 } },
      attributes: { OBJECTID: 12, BuildingName: "Administration", BLD_ID: "AD" },
      layer: this.buildingLayer,
    } }];
    this.buildingLayer.queryFeatures = async () => ({ features: this.features.map(result => result.graphic) });
    this.addEventListener("click", (event) => {
      const box = this.getBoundingClientRect();
      const detail = { x: event.clientX - box.left, y: event.clientY - box.top,
        screenPoint: { x: event.clientX - box.left, y: event.clientY - box.top },
        mapPoint: { latitude: 51.07817, longitude: -114.12715 }, pointerType: event.pointerType || "mouse" };
      this.dispatchEvent(new CustomEvent("arcgisViewImmediateClick", { detail }));
      setTimeout(() => this.dispatchEvent(new CustomEvent("arcgisViewClick", { detail })), 500);
    });
  }
  async viewOnReady() {}
  async whenLayerView(layer) {
    return { hasAllFeaturesInView: true, dataUpdating: false, queryFeatures: async () => ({
      features: this.features.filter((result) => result.graphic.layer === layer)
        .map((result) => result.graphic),
    }) };
  }
  async hitTest() {
    return { results: this.features.map((result) => {
      const graphic = result.graphic;
      if (graphic.layer.outFields.includes("*")) return result;
      return { ...result, graphic: { ...graphic, attributes: { OBJECTID: graphic.attributes.OBJECTID } } };
    }) };
  }
  async fetchPopupFeatures() { return (async function* () {})(); }
}
customElements.define("arcgis-map", ArcgisMap);
window.$arcgis = { import: async (name) => name.endsWith("Graphic.js") || name.endsWith("Extent.js") ? Graphic
  : { isWebMercator: () => false } };
