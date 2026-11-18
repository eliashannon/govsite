document.addEventListener("DOMContentLoaded", async () => {
    await window.PortalDataReady;
    const tableBody = document.getElementById("trainingList");
    const catalog = await window.CourseCatalog.load();
    if (!tableBody || !Array.isArray(catalog)) {
        console.error("Unable to load the training course catalog.");
        return;
    }

    let signedInProfile = null;
    try {
        signedInProfile = JSON.parse(sessionStorage.getItem("govsiteAccountProfile") || "null");
    } catch (error) {
        console.error("Unable to read the temporary account profile.", error);
    }
    const hasSignedInAccount = Boolean(signedInProfile && typeof signedInProfile === "object");

    const storageKeys = {
        completed: "portal.completedCourses",
        inProgress: "portal.inProgressCourses",
        role: "portal.selectedRole"
    };
    const defaultCompleted = ["TRN-001", "TRN-002"];
    const getCompletedCourses = () => {
        try {
            const value = JSON.parse(localStorage.getItem(storageKeys.completed) || "null");
            if (Array.isArray(value)) return value;
        } catch (error) {
            console.error("Unable to read completed courses from browser storage.", error);
            localStorage.removeItem(storageKeys.completed);
        }
        localStorage.setItem(storageKeys.completed, JSON.stringify(defaultCompleted));
        return [...defaultCompleted];
    };
    const readInProgressCourses = () => {
        try {
            const value = JSON.parse(localStorage.getItem(storageKeys.inProgress) || "null");
            if (Array.isArray(value)) return value;
            if (value !== null) {
                console.error("Stored in-progress course data is not a list.");
                localStorage.removeItem(storageKeys.inProgress);
            }
            return [];
        } catch (error) {
            console.error("Unable to read in-progress courses from browser storage.", error);
            localStorage.removeItem(storageKeys.inProgress);
            return [];
        }
    };

    let completedIds = getCompletedCourses();
    let inProgressIds = readInProgressCourses();
    let trainingProgressStore = {};
    try {
        const storedProgress = JSON.parse(localStorage.getItem("trainingProgress") || "{}");
        if (storedProgress && typeof storedProgress === "object" && !Array.isArray(storedProgress)) {
            trainingProgressStore = storedProgress;
        }
    } catch (error) {
        console.error("Unable to read module progress for the course catalog.", error);
    }

    let roleSelection = null;
    try {
        roleSelection = JSON.parse(localStorage.getItem(storageKeys.role) || "null");
    } catch (error) {
        console.error("Unable to read the saved role for the course catalog.", error);
        localStorage.removeItem(storageKeys.role);
    }
    const roleName = hasSignedInAccount ? roleSelection?.role || "" : "";
    const getCoursesForSelection = () => {
        if (!hasSignedInAccount) return [];
        return roleName
            ? catalog.filter(course => Array.isArray(course.roles) && course.roles.includes(roleName))
            : [];
    };
    let roleCourses = getCoursesForSelection();
    const roleProgressName = document.getElementById("roleProgressName");
    const roleProgressDetail = document.getElementById("roleProgressDetail");
    const roleProgressPercent = document.getElementById("roleProgressPercent");
    const roleProgressSummary = document.getElementById("roleProgressSummary");
    const roleProgressCompleted = document.getElementById("roleProgressCompleted");
    const roleProgressRemaining = document.getElementById("roleProgressRemaining");
    const roleProgressTrack = document.getElementById("roleProgressTrack");
    const roleProgressBar = document.getElementById("roleProgressBar");
    const updateRoleProgress = () => {
        const progressRoleName = roleName;
        if (!hasSignedInAccount || !progressRoleName) {
            roleProgressName.textContent = "N/A";
            roleProgressDetail.textContent = hasSignedInAccount
                ? "Select a role in Role Overview to view qualification progress."
                : "Sign in and select a role to view qualification progress.";
            roleProgressPercent.textContent = "N/A";
            roleProgressSummary.textContent = "N/A";
            roleProgressCompleted.textContent = "N/A";
            roleProgressRemaining.textContent = "N/A";
            roleProgressBar.style.width = "0";
            roleProgressTrack.removeAttribute("aria-valuenow");
            roleProgressTrack.setAttribute("aria-valuetext", "N/A");
            return;
        }
        const selectedRoleCourses = roleCourses.filter(course =>
            Array.isArray(course.roles) && course.roles.includes(progressRoleName)
        );
        const requiredCourses = selectedRoleCourses.filter(course => course.requirement === "Required");
        const completedRequired = requiredCourses.filter(course => getCourseStatus(course) === "Completed");
        const remainingRequired = requiredCourses.length - completedRequired.length;
        const percent = requiredCourses.length
            ? Math.round((completedRequired.length / requiredCourses.length) * 100)
            : 0;
        const roleDetails = roleSelection?.role === progressRoleName
            ? [roleSelection.branch, roleSelection.division].filter(value => typeof value === "string" && value.trim()).join(" · ")
            : "";

        roleProgressName.textContent = progressRoleName;
        roleProgressDetail.textContent = roleDetails || "Required course completion for your selected role.";
        roleProgressPercent.textContent = `${percent}%`;
        roleProgressSummary.textContent = `${completedRequired.length} of ${requiredCourses.length} required courses completed`;
        roleProgressCompleted.textContent = `${completedRequired.length} completed`;
        roleProgressRemaining.textContent = `${remainingRequired} remaining`;
        roleProgressBar.style.width = `${percent}%`;
        roleProgressTrack.removeAttribute("aria-valuetext");
        roleProgressTrack.setAttribute("aria-valuenow", String(percent));
    };

    const searchInput = document.getElementById("trainingSearch");
    const headerSearchInput = document.querySelector("[data-portal-search]");
    const categoryFilter = document.getElementById("trainingCategory");
    const statusFilter = document.getElementById("trainingStatus");
    const sortFilter = document.getElementById("trainingSort");
    const clearFiltersButton = document.getElementById("clearCourseFilters");
    const emptyState = document.getElementById("trainingEmptyState");
    const pagination = document.getElementById("coursePagination");
    const resultsSummary = document.getElementById("resultsSummary");
    const listTitle = document.getElementById("trainingListTitle");
    const listSubtitle = document.getElementById("trainingListSubtitle");
    const dialog = document.getElementById("courseDetailsDialog");
    const dialogTitle = document.getElementById("courseDialogTitle");
    const dialogDescription = document.getElementById("courseDialogDescription");
    const dialogFields = document.getElementById("courseDialogFields");
    const actionNotice = document.getElementById("courseActionNotice");
    const primaryAction = document.getElementById("coursePrimaryAction");
    const completionToggle = document.getElementById("courseCompletionToggle");
    const pageSize = 8;
    let currentPage = 1;
    let currentCourse = null;

    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);

    const getCourseStatus = course =>
        window.CourseCatalog.status(course, completedIds, inProgressIds, trainingProgressStore);

    const updateStats = () => {
        if (!hasSignedInAccount) {
            document.getElementById("headerCourseCount").textContent = "N/A";
            document.getElementById("totalCourseStat").textContent = "N/A";
            document.getElementById("notStartedStat").textContent = "N/A";
            document.getElementById("inProgressStat").textContent = "N/A";
            document.getElementById("completedStat").textContent = "N/A";
            return;
        }
        const completed = roleCourses.filter(course => getCourseStatus(course) === "Completed").length;
        const inProgress = roleCourses.filter(course => getCourseStatus(course) === "In Progress").length;
        const total = roleCourses.length;
        document.getElementById("headerCourseCount").textContent = String(total);
        document.getElementById("totalCourseStat").textContent = String(total);
        document.getElementById("notStartedStat").textContent = String(total - completed - inProgress);
        document.getElementById("inProgressStat").textContent = String(inProgress);
        document.getElementById("completedStat").textContent = String(completed);
    };

    const durationInMinutes = duration => {
        const match = String(duration).match(/(\d+(?:\.\d+)?)\s*(minute|min|hour|hr)s?/i);
        if (!match) return null;
        return Number(match[1]) * (/^(minute|min)/i.test(match[2]) ? 1 : 60);
    };

    const renderCourseRow = course => {
        const status = getCourseStatus(course);
        const statusClass = status.toLowerCase().replaceAll(" ", "-");
        const actionLabel = status === "Completed"
            ? "Review Course"
            : status === "In Progress" ? "Continue Course" : "Start Course";
        const courseHref = `training.html?course=${encodeURIComponent(course.id)}`;
        return `
            <tr>
                <td class="course-name-cell" data-label="Course Name">
                    <strong class="course-name-title">${escapeHtml(course.title)}</strong>
                    <span class="course-name-description">${escapeHtml(course.description)}</span>
                </td>
                <td data-label="Category"><span class="course-category"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"></path></svg>${escapeHtml(course.category)}</span></td>
                <td class="course-duration" data-label="Duration">${escapeHtml(course.duration)}</td>
                <td data-label="Status"><span class="course-status course-status-${statusClass}">${status}</span></td>
                <td data-label="Actions"><div class="course-row-actions"><a class="course-view-button" href="${courseHref}" data-view-course="${escapeHtml(course.id)}">${actionLabel}</a></div></td>
            </tr>`;
    };

    const renderPagination = pageCount => {
        pagination.hidden = pageCount <= 1;
        if (pageCount <= 1) {
            pagination.innerHTML = "";
            return;
        }
        const pageButtons = Array.from({ length: pageCount }, (_, index) => {
            const page = index + 1;
            return `<button type="button" data-page="${page}" ${page === currentPage ? 'aria-current="page"' : ""}>${page}</button>`;
        }).join("");
        pagination.innerHTML = `
            <button type="button" data-page="${currentPage - 1}" aria-label="Previous page" ${currentPage === 1 ? "disabled" : ""}>‹</button>
            ${pageButtons}
            <button type="button" data-page="${currentPage + 1}" aria-label="Next page" ${currentPage === pageCount ? "disabled" : ""}>›</button>`;
    };

    const render = () => {
        const query = searchInput.value.trim().toLowerCase();
        const category = categoryFilter.value;
        const status = statusFilter.value;
        const filtered = roleCourses.filter(course => {
            const searchableText = [
                course.title, course.description, course.category, course.requirement,
                course.duration, course.frequency, course.id,
                course.division, course.branch, course.role
            ].join(" ").toLowerCase();
            return searchableText.includes(query)
                && (category === "All" || course.category === category)
                && (status === "All" || getCourseStatus(course) === status);
        });

        const sort = sortFilter.value;
        filtered.sort((left, right) => {
            if (sort === "name-desc") return right.title.localeCompare(left.title);
            if (sort === "duration-asc" || sort === "duration-desc") {
                const leftDuration = durationInMinutes(left.duration);
                const rightDuration = durationInMinutes(right.duration);
                if (leftDuration === null) return rightDuration === null ? 0 : 1;
                if (rightDuration === null) return -1;
                return (leftDuration - rightDuration) * (sort === "duration-asc" ? 1 : -1);
            }
            return left.title.localeCompare(right.title);
        });

        const pageCount = Math.ceil(filtered.length / pageSize);
        currentPage = Math.min(currentPage, Math.max(pageCount, 1));
        const pageCourses = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
        tableBody.innerHTML = pageCourses.map(renderCourseRow).join("");
        resultsSummary.textContent = !hasSignedInAccount
            ? "N/A"
            : filtered.length
                ? `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} courses`
                : `Showing 0 of ${filtered.length} courses`;
        updateStats();
        updateRoleProgress();
        renderPagination(pageCount);
        listTitle.textContent = !hasSignedInAccount
            ? "Training Courses"
            : roleName ? `Available Training for ${roleName}` : "Available Training";
        listSubtitle.textContent = !hasSignedInAccount
            ? "Sign in to view your role-based training courses."
            : roleName
                ? "Review role-based course requirements and applicable learning resources."
                : "Select a role in Role Overview to view your assigned courses.";

        if (!hasSignedInAccount) {
            emptyState.innerHTML = '<strong>Sign in to view training courses.</strong><span>Your role-based course catalog will appear after you sign in.</span><a href="account.html">Go to sign in</a>';
            emptyState.hidden = false;
        } else if (!roleName) {
            emptyState.innerHTML = '<strong>Select a role to see assigned courses.</strong><span>Choose your role in Role Overview to view the course catalog.</span><a href="role-overview.html">Go to Role Overview →</a>';
            emptyState.hidden = false;
        } else if (filtered.length === 0) {
            emptyState.innerHTML = '<strong>No courses match these filters.</strong><span>Try a different search or clear some filters.</span>';
            emptyState.hidden = false;
        } else {
            emptyState.hidden = true;
        }
    };

    const setCourseFields = course => {
        const fields = [
            ["Category", course.category],
            ...(course.assignment || course.division ? [[
                "Assigned to",
                [course.assignment?.division || course.division, course.assignment?.branch || course.branch, course.assignment?.role || course.role]
                    .filter(Boolean).join(" / ")
            ]] : []),
            ["Estimated duration", course.duration],
            ["Requirement", course.requirement],
            ["Frequency", course.frequency],
            ["Current status", getCourseStatus(course)],
            ...(Array.isArray(course.sourceReferences) ? [[
                "Handbook source references",
                course.sourceReferences.map(reference =>
                    `${reference.documentName} — page ${reference.pageNumber || "unavailable"}, section ${reference.sectionNumber || "not identified"}`
                ).join("; ")
            ]] : [])
        ];
        dialogFields.innerHTML = fields.map(([label, value]) => `
            <dl class="course-detail-item"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></dl>
        `).join("");
    };

    const hasCourseLink = course => Boolean(course.link && course.link !== "#");
    const openCourseDetails = course => {
        currentCourse = course;
        dialogTitle.textContent = course.title;
        dialogDescription.textContent = course.description;
        actionNotice.hidden = true;
        actionNotice.textContent = "";
        setCourseFields(course);
        const status = getCourseStatus(course);
        primaryAction.textContent = status === "Completed"
            ? "Review Course"
            : status === "In Progress" ? "Continue Course" : "Start Course";
        completionToggle.textContent = status === "Completed" ? "Mark as not completed" : "Mark as completed";
        if (!dialog.open) dialog.showModal();
    };

    const saveStatus = () => {
        localStorage.setItem(storageKeys.completed, JSON.stringify(completedIds));
        localStorage.setItem(storageKeys.inProgress, JSON.stringify(inProgressIds));
    };

    const updateCategoryOptions = () => {
        const currentCategory = categoryFilter.value || "All";
        const categories = [...new Set(roleCourses.map(course => course.category))].sort((a, b) => a.localeCompare(b));
        categoryFilter.innerHTML = '<option value="All">All categories</option>' + categories.map(category =>
            `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
        ).join("");
        categoryFilter.value = categories.includes(currentCategory) ? currentCategory : "All";
    };
    const refreshCatalogue = () => {
        roleCourses = getCoursesForSelection();
        updateCategoryOptions();
        currentPage = 1;
        render();
    };

    updateCategoryOptions();

    [searchInput, headerSearchInput].filter(Boolean).forEach(input => {
        input.addEventListener("input", () => {
            [searchInput, headerSearchInput].filter(Boolean).forEach(otherInput => {
                if (otherInput !== input) otherInput.value = input.value;
            });
            currentPage = 1;
            render();
        });
    });
    [categoryFilter, statusFilter, sortFilter].forEach(filter => {
        filter.addEventListener("change", () => {
            currentPage = 1;
            render();
        });
    });
    clearFiltersButton.addEventListener("click", () => {
        searchInput.value = "";
        if (headerSearchInput) headerSearchInput.value = "";
        categoryFilter.value = "All";
        statusFilter.value = "All";
        sortFilter.value = "name-asc";
        currentPage = 1;
        refreshCatalogue();
    });
    tableBody.addEventListener("click", event => {
        const link = event.target.closest("[data-view-course]");
        if (!link) return;
        const course = roleCourses.find(item => item.id === link.dataset.viewCourse);
        if (course && getCourseStatus(course) === "Not Started") {
            inProgressIds = [...new Set([...inProgressIds, course.id])];
            saveStatus();
        }
        // Use the real link destination so the dynamic training page works in all browsers.
        window.location.href = link.getAttribute("href");
    });
    pagination.addEventListener("click", event => {
        const button = event.target.closest("[data-page]");
        if (!button || button.disabled) return;
        currentPage = Number(button.dataset.page);
        render();
    });

    document.getElementById("closeCourseDialog").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
        if (event.target === dialog) dialog.close();
    });
    primaryAction.addEventListener("click", () => {
        if (!currentCourse) return;
        if (getCourseStatus(currentCourse) !== "Completed"
            && !inProgressIds.includes(currentCourse.id)) {
            inProgressIds = [...new Set([...inProgressIds, currentCourse.id])];
            saveStatus();
        }
        window.location.href = `training.html?course=${encodeURIComponent(currentCourse.id)}`;
    });
    completionToggle.addEventListener("click", () => {
        if (!currentCourse) return;
        if (getCourseStatus(currentCourse) === "Completed") {
            if (Object.hasOwn(trainingProgressStore, currentCourse.id)) {
                const updated = {...trainingProgressStore};
                delete updated[currentCourse.id];
                try {
                    localStorage.setItem("trainingProgress", JSON.stringify(updated));
                    trainingProgressStore = updated;
                } catch (error) {
                    console.error("Unable to reset module progress.", error);
                    actionNotice.textContent = "Unable to reset module progress. Please try again.";
                    actionNotice.hidden = false;
                    return;
                }
            }
            completedIds = completedIds.filter(id => id !== currentCourse.id);
            inProgressIds = inProgressIds.filter(id => id !== currentCourse.id);
        } else {
            completedIds = [...new Set([...completedIds, currentCourse.id])];
            inProgressIds = inProgressIds.filter(id => id !== currentCourse.id);
        }
        saveStatus();
        render();
        setCourseFields(currentCourse);
        const status = getCourseStatus(currentCourse);
        primaryAction.textContent = status === "Completed"
            ? "Review Course"
            : status === "In Progress" ? "Continue Course" : "Start Course";
        completionToggle.textContent = status === "Completed" ? "Mark as not completed" : "Mark as completed";
        actionNotice.hidden = true;
    });

    if (!hasSignedInAccount) {
        document.getElementById("totalCourseStat").textContent = "N/A";
    } else if (!roleName) {
        const emptyCourses = document.getElementById("totalCourseStat");
        emptyCourses.textContent = "0";
    }
    render();
    const requestedCourseId = new URLSearchParams(window.location.search).get("course");
    const requestedCourse = requestedCourseId
        ? roleCourses.find(course => course.id === requestedCourseId)
        : null;
    if (requestedCourse) openCourseDetails(requestedCourse);
});
