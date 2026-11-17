window.BuildInfo = {name:"Training & Qualification Portal",version:"1.0.0",environment:"Development",pipeline:"Local",lastUpdated:"November 2026"};
window.BuildInfo.refresh = () => {
    document.querySelectorAll("[data-build-version]").forEach(el => el.textContent = `Version ${window.BuildInfo.version}`);
    document.querySelectorAll("[data-build-environment]").forEach(el => el.textContent = window.BuildInfo.environment);
    document.querySelectorAll("[data-build-pipeline]").forEach(el => el.textContent = `Pipeline #${window.BuildInfo.pipeline}`);
};
document.addEventListener("DOMContentLoaded", window.BuildInfo.refresh);
