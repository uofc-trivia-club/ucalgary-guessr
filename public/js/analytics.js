// Vercel serves this browser script when Web Analytics is enabled. Keep the
// integration independent of packages bundled into the Express function.
window.va = window.va || function (...args) {
  (window.vaq = window.vaq || []).push(args);
};

const scriptPath = "/_vercel/insights/script.js";
if (!document.head.querySelector(`script[src="${scriptPath}"]`)) {
  const script = document.createElement("script");
  script.src = scriptPath;
  script.defer = true;
  document.head.appendChild(script);
}
