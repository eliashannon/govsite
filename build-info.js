window.BuildInfo = {name:"Training & Qualification Portal",version:"1.0.0",environment:"Development",lastUpdated:"November 2026"};
let workflowCountRequest;

function refreshWorkflowCount() {
    const indicators = document.querySelectorAll("[data-workflow-count]");
    if (!indicators.length || workflowCountRequest) return;

    workflowCountRequest = fetch("https://api.github.com/repos/eliashannon/govsite/actions/runs?status=completed&per_page=1", {
        headers: {Accept:"application/vnd.github+json"}
    })
        .then(response => {
            if (!response.ok) throw new Error(`GitHub Actions API returned ${response.status}.`);
            return response.json();
        })
        .then(data => {
            if (!Number.isInteger(data.total_count)) throw new Error("GitHub Actions API response did not include a workflow run count.");
            document.querySelectorAll("[data-workflow-count]").forEach(el => {
                el.textContent = `${data.total_count} completed`;
            });
        })
        .catch(error => {
            console.error("Unable to load the completed GitHub workflow count.", error);
            document.querySelectorAll("[data-workflow-count]").forEach(el => {
                el.textContent = "Count unavailable";
            });
        });
}

window.BuildInfo.refresh = () => {
    document.querySelectorAll("[data-build-version]").forEach(el => el.textContent = `Version ${window.BuildInfo.version}`);
    document.querySelectorAll("[data-build-environment]").forEach(el => el.textContent = window.BuildInfo.environment);
    refreshWorkflowCount();
};
document.addEventListener("DOMContentLoaded", window.BuildInfo.refresh);
