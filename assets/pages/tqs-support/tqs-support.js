document.addEventListener("DOMContentLoaded", async () => {
    await window.PortalDataReady;
    const emptyState = document.getElementById("tqsNoRole");
    const emptyTitle = document.getElementById("tqsEmptyTitle");
    const emptyMessage = document.getElementById("tqsEmptyMessage");
    const emptyLink = document.getElementById("tqsEmptyLink");

    let profile = null;
    try {
        profile = JSON.parse(sessionStorage.getItem("govsiteAccountProfile") || "null");
    } catch (error) {
        console.error("Unable to read the temporary account profile.", error);
    }

    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
        emptyTitle.textContent = "Sign in to view your requirements";
        emptyMessage.textContent = "Sign in and select a role in Role Overview to see its qualification requirements.";
        emptyLink.href = "account.html";
        emptyLink.textContent = "Go to Sign In";
        emptyState.hidden = false;
        return;
    }

    let roleSelection = null;
    try {
        roleSelection = JSON.parse(localStorage.getItem("portal.selectedRole") || "null");
    } catch (error) {
        console.error("Unable to read the selected role.", error);
    }
    const roleName = typeof roleSelection?.role === "string" ? roleSelection.role.trim() : "";
    if (!roleName) {
        emptyState.hidden = false;
        return;
    }

    if (window.DemoTqs.matches(profile, roleSelection)) {
        window.DemoTqs.start(profile, roleSelection);
        return;
    }

    document.getElementById("selectedRoleName").textContent = roleName;
    document.getElementById("selectedRoleDescription").textContent = "No TQS is currently available for this role.";
    document.getElementById("selectedRoleDivision").textContent = roleSelection.division || "";
    document.getElementById("selectedRoleBranch").textContent = roleSelection.branch || "";
    document.getElementById("progressSummary").textContent = "No TQS available for this role.";
    document.getElementById("tqsTracker").hidden = false;
    document.getElementById("tqsUnavailable").hidden = false;
    document.querySelector("[data-tqs-search]").disabled = true;
});
