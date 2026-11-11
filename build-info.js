window.BuildInfo = {name:"Training & Qualification Portal",version:"1.0.0",environment:"Development",lastUpdated:"November 2026"};
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-build-version]").forEach(el => el.textContent = `Version ${window.BuildInfo.version}`);
    document.querySelectorAll("[data-build-environment]").forEach(el => el.textContent = window.BuildInfo.environment);
});
