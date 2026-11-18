document.addEventListener("DOMContentLoaded", async () => {
    await window.PortalDataReady;
    const emptyState = document.getElementById("tqsNoRole");
    const emptyTitle = document.getElementById("tqsEmptyTitle");
    const emptyMessage = document.getElementById("tqsEmptyMessage");
    const emptyLink = document.getElementById("tqsEmptyLink");
    const tracker = document.getElementById("tqsTracker");
    const sectionsContainer = document.getElementById("requirementsList");
    const listEmpty = document.getElementById("requirementsEmpty");
    const storageNotice = document.getElementById("tqsStorageNotice");
    const searchInput = document.getElementById("requirementSearch");
    const headerSearchInput = document.querySelector("[data-tqs-search]");
    const statusFilter = document.getElementById("statusFilter");
    const sortFilter = document.getElementById("sortFilter");
    const dialog = document.getElementById("requirementDialog");
    const storagePrefix = "portal.tqsProgress";
    const allowedStatuses = new Set(["Not Started", "In Progress", "Completed"]);
    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);

    let profile = null;
    try {
        profile = JSON.parse(sessionStorage.getItem("govsiteAccountProfile") || "null");
    } catch (error) {
        console.error("Unable to read the temporary account profile.", error);
    }

    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
        emptyTitle.textContent = "Sign in to view your requirements";
        emptyMessage.textContent = "Sign in and select a role in Role Overview to see its required training.";
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

    const allCourses = window.PortalData?.courses;
    if (!Array.isArray(allCourses)) {
        console.error("Unable to load role-required training data.");
        emptyTitle.textContent = "Requirements are unavailable";
        emptyMessage.textContent = "The training catalog could not be loaded. Please try again later.";
        emptyLink.hidden = true;
        emptyState.hidden = false;
        return;
    }

    const requirements = allCourses.filter(course =>
        Array.isArray(course.roles)
        && course.roles.includes(roleName)
        && course.requirement === "Required"
    );
    const accountId = typeof profile.email === "string" ? profile.email.trim().toLowerCase() : "";
    if (!accountId) {
        console.error("The current account does not have an email identifier for saved requirement progress.");
        emptyTitle.textContent = "Progress tracking is unavailable";
        emptyMessage.textContent = "This account is missing an identifier needed to save progress.";
        emptyLink.hidden = true;
        emptyState.hidden = false;
        return;
    }

    const storageKey = `${storagePrefix}:${encodeURIComponent(accountId)}:${encodeURIComponent(roleName)}`;
    let progress = {};
    try {
        const savedProgress = JSON.parse(localStorage.getItem(storageKey) || "{}");
        if (savedProgress && typeof savedProgress === "object" && !Array.isArray(savedProgress)) {
            progress = Object.fromEntries(Object.entries(savedProgress).filter(([id, value]) =>
                requirements.some(course => course.id === id)
                && value
                && typeof value === "object"
                && allowedStatuses.has(value.status)
                && (value.completedAt === null || typeof value.completedAt === "string")
            ));
        } else {
            console.error("Saved TQS progress is not a valid record.");
            localStorage.removeItem(storageKey);
        }
    } catch (error) {
        console.error("Unable to read saved TQS progress.", error);
        localStorage.removeItem(storageKey);
    }

    document.getElementById("selectedRoleName").textContent = roleName;
    document.getElementById("selectedRoleDescription").textContent =
        "Role-required training from the existing course catalog.";
    document.getElementById("selectedRoleDivision").textContent = roleSelection.division || "";
    document.getElementById("selectedRoleBranch").textContent = roleSelection.branch || "";
    tracker.hidden = false;

    const getStatus = requirement => progress[requirement.id]?.status || "Not Started";
    const getCompletedAt = requirement => progress[requirement.id]?.completedAt || null;
    let activeRequirement = null;

    const displayDate = value => {
        if (!value) return "";
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    };

    const statusClass = status => status.toLowerCase().replaceAll(" ", "-");
    const linkedTrainingModules = requirement => (window.PortalData.publishedTrainingModules || [])
        .filter(module => module.tqsRequirementIds.includes(requirement.id) && module.roleIds.includes(roleName));
    const filteredRequirements = () => {
        const query = searchInput.value.trim().toLowerCase();
        const selectedStatus = statusFilter.value;
        const filtered = requirements.filter(requirement => {
            const matchesQuery = [requirement.id, requirement.title, requirement.description, requirement.category]
                .some(value => String(value || "").toLowerCase().includes(query));
            return matchesQuery && (selectedStatus === "All" || getStatus(requirement) === selectedStatus);
        });
        filtered.sort((left, right) => {
            if (sortFilter.value === "name-desc") return right.title.localeCompare(left.title);
            if (sortFilter.value === "id-asc") return left.id.localeCompare(right.id, undefined, { numeric: true });
            return left.title.localeCompare(right.title);
        });
        return filtered;
    };

    const renderRequirement = requirement => {
        const status = getStatus(requirement);
        const date = displayDate(getCompletedAt(requirement));
        const linkedModules = linkedTrainingModules(requirement);
        return `
            <article class="tqs-requirement tqs-status-${statusClass(status)}" data-requirement-id="${escapeHtml(requirement.id)}">
                <label class="tqs-checkbox">
                    <input type="checkbox" data-complete-requirement="${escapeHtml(requirement.id)}" ${status === "Completed" ? "checked" : ""} aria-label="${status === "Completed" ? "Mark incomplete" : "Mark complete"}: ${escapeHtml(requirement.title)}">
                    <span aria-hidden="true"></span>
                </label>
                <div class="tqs-requirement-copy">
                    <button class="tqs-requirement-title" type="button" data-open-requirement="${escapeHtml(requirement.id)}">${escapeHtml(requirement.title)}</button>
                    <p>${escapeHtml(requirement.description)}</p>
                    <div class="tqs-requirement-meta"><span>${escapeHtml(requirement.id)}</span><span>${escapeHtml(requirement.category)}</span>${date ? `<span>Completed ${escapeHtml(date)}</span>` : ""}</div>
                    ${linkedModules.length ? `<div class="tqs-linked-content"><strong>Published handbook material</strong>${linkedModules.map(module =>
                        `<a href="required-training.html?role=${encodeURIComponent(roleName)}&course=${encodeURIComponent(module.courseId)}">${escapeHtml(module.title)}</a>`
                    ).join("")}</div>` : ""}
                </div>
                <div class="tqs-requirement-actions">
                    <span class="tqs-status-badge tqs-badge-${statusClass(status)}">${escapeHtml(status)}</span>
                    <button class="tqs-details-button" type="button" data-open-requirement="${escapeHtml(requirement.id)}">Details</button>
                </div>
            </article>`;
    };

    const render = () => {
        const filtered = filteredRequirements();
        const categories = [...new Set(requirements.map(requirement => requirement.category || "Other"))]
            .sort((left, right) => left.localeCompare(right));
        const sections = categories.map(category => {
            const categoryRequirements = filtered.filter(requirement => (requirement.category || "Other") === category);
            if (!categoryRequirements.length) return "";
            const allInSection = requirements.filter(requirement => (requirement.category || "Other") === category);
            const completedInSection = allInSection.filter(requirement => getStatus(requirement) === "Completed").length;
            return `
                <details class="tqs-section" open>
                    <summary class="tqs-section-heading">
                        <span><strong>${escapeHtml(category)}</strong><small>${completedInSection} of ${allInSection.length} completed</small></span>
                        <span class="tqs-section-chevron" aria-hidden="true"></span>
                    </summary>
                    <div class="tqs-section-items">${categoryRequirements.map(renderRequirement).join("")}</div>
                </details>`;
        }).join("");
        sectionsContainer.innerHTML = sections;
        listEmpty.hidden = filtered.length !== 0;
        listEmpty.textContent = requirements.length
            ? "No requirements match these filters. Try another search or clear the filters."
            : `No role-required courses are currently listed for ${roleName}.`;

        const completed = requirements.filter(requirement => getStatus(requirement) === "Completed").length;
        const inProgress = requirements.filter(requirement => getStatus(requirement) === "In Progress").length;
        const notStarted = requirements.length - completed - inProgress;
        const percentage = requirements.length ? Math.round((completed / requirements.length) * 100) : 0;
        document.getElementById("totalCount").textContent = String(requirements.length);
        document.getElementById("completedCount").textContent = String(completed);
        document.getElementById("inProgressCount").textContent = String(inProgress);
        document.getElementById("notStartedCount").textContent = String(notStarted);
        document.getElementById("progressPercent").textContent = `${percentage}%`;
        document.getElementById("progressSummary").textContent = `${completed} of ${requirements.length} requirements completed`;
        document.getElementById("progressBar").style.width = `${percentage}%`;
        const progressTrack = document.querySelector(".tqs-progress-track");
        progressTrack.setAttribute("aria-valuenow", String(percentage));

        const allComplete = requirements.length > 0 && completed === requirements.length;
        const completionBanner = document.getElementById("qualificationComplete");
        completionBanner.hidden = !allComplete;
        if (allComplete) {
            const dates = requirements.map(getCompletedAt).filter(Boolean).map(value => new Date(value).getTime());
            const finalDate = dates.length ? displayDate(new Date(Math.max(...dates)).toISOString()) : "";
            document.getElementById("qualificationCompleteDate").textContent = finalDate
                ? `${roleName} — completed ${finalDate}. This tracker does not constitute formal qualification approval.`
                : `${roleName} — all tracked requirements are complete. This tracker does not constitute formal qualification approval.`;
        }
    };

    const saveProgress = () => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(progress));
            storageNotice.hidden = true;
            return true;
        } catch (error) {
            console.error("Unable to save TQS progress.", error);
            storageNotice.hidden = false;
            return false;
        }
    };

    const updateRequirement = (requirement, status) => {
        if (status === "Not Started") {
            delete progress[requirement.id];
        } else {
            progress[requirement.id] = {
                status,
                completedAt: status === "Completed"
                    ? getStatus(requirement) === "Completed"
                        ? getCompletedAt(requirement) || new Date().toISOString()
                        : new Date().toISOString()
                    : null
            };
        }
        saveProgress();
        render();
        if (activeRequirement?.id === requirement.id && dialog.open) renderDialog(requirement);
    };

    const renderDialog = requirement => {
        activeRequirement = requirement;
        const status = getStatus(requirement);
        document.getElementById("dialogId").textContent = requirement.id;
        document.getElementById("dialogTitle").textContent = requirement.title;
        document.getElementById("dialogDescription").textContent = requirement.description || "";
        const details = [
            ["Category", requirement.category],
            ["Estimated duration", requirement.duration],
            ["Frequency", requirement.frequency],
            ["Requirement type", requirement.requirement],
            ["Current status", status],
            ...(displayDate(getCompletedAt(requirement)) ? [["Completion date", displayDate(getCompletedAt(requirement))]] : [])
        ].filter(([, value]) => value);
        document.getElementById("dialogDetails").innerHTML = details.map(([label, value]) =>
            `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
        ).join("");
        const courseLink = document.getElementById("dialogCourseLink");
        const courseHref = requirement.link && requirement.link !== "#" ? requirement.link : "required-training.html";
        const linkedModules = linkedTrainingModules(requirement);
        courseLink.innerHTML = `<a href="${escapeHtml(courseHref)}">${requirement.link && requirement.link !== "#" ? "Open related course" : "View in Training Courses"} →</a>${linkedModules.map(module =>
            `<a href="required-training.html?role=${encodeURIComponent(roleName)}&course=${encodeURIComponent(module.courseId)}">${escapeHtml(module.title)} →</a>`
        ).join("")}`;
        document.getElementById("dialogInProgress").hidden = status === "Completed" || status === "In Progress";
        document.getElementById("dialogToggleComplete").textContent = status === "Completed" ? "Mark Incomplete" : "Mark Complete";
        if (!dialog.open) dialog.showModal();
    };

    sectionsContainer.addEventListener("change", event => {
        const checkbox = event.target.closest("[data-complete-requirement]");
        if (!checkbox) return;
        const requirement = requirements.find(item => item.id === checkbox.dataset.completeRequirement);
        if (requirement) updateRequirement(requirement, checkbox.checked ? "Completed" : "Not Started");
    });
    sectionsContainer.addEventListener("click", event => {
        const detailButton = event.target.closest("[data-open-requirement]");
        if (!detailButton) return;
        const requirement = requirements.find(item => item.id === detailButton.dataset.openRequirement);
        if (requirement) renderDialog(requirement);
    });
    const updateFilters = () => {
        searchInput.value = headerSearchInput.value;
        render();
    };
    searchInput.addEventListener("input", () => {
        headerSearchInput.value = searchInput.value;
        render();
    });
    headerSearchInput.addEventListener("input", updateFilters);
    statusFilter.addEventListener("change", render);
    sortFilter.addEventListener("change", render);
    document.getElementById("clearFilters").addEventListener("click", () => {
        searchInput.value = "";
        headerSearchInput.value = "";
        statusFilter.value = "All";
        sortFilter.value = "name-asc";
        render();
    });
    document.getElementById("closeDialog").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
        if (event.target === dialog) dialog.close();
    });
    document.getElementById("dialogToggleComplete").addEventListener("click", () => {
        if (activeRequirement) {
            updateRequirement(activeRequirement, getStatus(activeRequirement) === "Completed" ? "Not Started" : "Completed");
        }
    });
    document.getElementById("dialogInProgress").addEventListener("click", () => {
        if (activeRequirement) updateRequirement(activeRequirement, "In Progress");
    });

    render();
});
