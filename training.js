document.addEventListener("DOMContentLoaded", () => {
    const completionKey = "portal.completedCourses";
    const defaultCompletedCourses = ["TRN-001", "TRN-002"];

    function getCompletedCourses() {
        try {
            const stored = JSON.parse(localStorage.getItem(completionKey) || "null");
            if (Array.isArray(stored)) return stored;
        } catch (error) {
            localStorage.removeItem(completionKey);
        }
        localStorage.setItem(completionKey, JSON.stringify(defaultCompletedCourses));
        return defaultCompletedCourses;
    }

    function setCompletedCourses(completed) {
        localStorage.setItem(completionKey, JSON.stringify(completed));
    }

    const roleSelection = (() => {
        try {
            return JSON.parse(localStorage.getItem("portal.selectedRole") || "null");
        } catch (error) {
            localStorage.removeItem("portal.selectedRole");
            return null;
        }
    })();
    const roleName = new URLSearchParams(window.location.search).get("role") || (roleSelection && roleSelection.role);

    const accountProgressRole = document.getElementById("accountProgressRole");
    if (accountProgressRole) {
        const courses = window.PortalData ? window.PortalData.courses : [];
        const roleCourses = courseRoleName
            ? courses.filter(course => Array.isArray(course.roles) && course.roles.includes(courseRoleName))
            : courses.filter(course => course.requirement === "Required");
        const completed = getCompletedCourses();
        const requiredCourses = roleCourses.filter(course => course.requirement === "Required");
        const completedRequired = requiredCourses.filter(course => completed.includes(course.id));
        const remainingCourses = requiredCourses.filter(course => !completed.includes(course.id));
        const percent = requiredCourses.length
            ? Math.round((completedRequired.length / requiredCourses.length) * 100)
            : 0;

        accountProgressRole.textContent = roleName || "No role selected";
        const roleDetail = document.getElementById("accountProgressRoleDetail");
        if (roleDetail) {
            roleDetail.textContent = roleName
                ? `${roleSelection && roleSelection.branch ? `${roleSelection.branch} · ` : ""}${roleSelection && roleSelection.division ? roleSelection.division : "Assigned position"}`
                : "Select your role to personalize this training center.";
        }

        document.getElementById("tqsProgressPercent").textContent = `${percent}%`;
        document.getElementById("tqsCompletedCount").textContent = completedRequired.length;
        document.getElementById("tqsRemainingCount").textContent = remainingCourses.length;
        const progressTrack = document.querySelector(".progress-track");
        const progressBar = document.getElementById("tqsProgressBar");
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressTrack) progressTrack.setAttribute("aria-valuenow", String(percent));

        const taken = roleCourses.filter(course => completed.includes(course.id));
        const takenList = document.getElementById("takenTrainingList");
        const takenCount = document.getElementById("takenTrainingCount");
        if (takenCount) takenCount.textContent = `${taken.length} completed`;
        if (takenList) {
            takenList.innerHTML = taken.length
                ? taken.map(course => `<div class="progress-course"><span class="progress-course-icon">✓</span><div><h3>${course.title}</h3><p>${course.category} · ${course.duration}</p></div><span class="badge badge-success">Completed</span></div>`).join("")
                : `<p class="progress-empty">No training courses have been completed for this role.</p>`;
        }

        const remainingList = document.getElementById("remainingTrainingList");
        if (remainingList) {
            remainingList.innerHTML = remainingCourses.length
                ? remainingCourses.map(course => `<div class="progress-course"><span class="progress-course-icon progress-course-icon-pending">○</span><div><h3>${course.title}</h3><p>${course.category} · ${course.duration}</p></div><span class="badge badge-warning">Remaining</span></div>`).join("")
                : `<p class="progress-empty">All required TQS training is complete.</p>`;
        }
        return;
    }

    const container = document.getElementById("trainingList");
    if (!container || !window.PortalData) return;
    const courses = window.PortalData.courses;
    const storedRole = JSON.parse(localStorage.getItem("portal.selectedRole") || "null");
    const requestedRole = new URLSearchParams(window.location.search).get("role");
    const courseRoleName = requestedRole || (storedRole && storedRole.role);
    const listTitle = document.getElementById("trainingListTitle");
    const listSubtitle = document.getElementById("trainingListSubtitle");

    function render(filter="All", query="") {
        const roleCourses = courseRoleName
            ? courses.filter(course => Array.isArray(course.roles) && course.roles.includes(courseRoleName))
            : [];

        const filtered = roleCourses.filter(course => {
            const categoryMatch = filter === "All" || course.category === filter;
            const text = [course.title,course.description,course.category,course.requirement].join(" ").toLowerCase();
            return categoryMatch && text.includes(query.toLowerCase());
        });

        if (listTitle) {
            listTitle.textContent = courseRoleName ? `Available Training for ${courseRoleName}` : "Available Training";
        }

        if (listSubtitle) {
            listSubtitle.textContent = courseRoleName
                ? "Review role-based course requirements and applicable learning resources."
                : "Select a role in Role Overview to view applicable training requirements.";
        }

        container.innerHTML = filtered.map(course => `
            <article class="card course-card" data-searchable>
                <div class="card-header"><span class="badge">${course.requirement}</span><span class="badge">${course.category}</span></div>
                <h3>${course.title}</h3><p class="card-description">${course.description}</p>
                <div class="list-item"><div><h4>Estimated Duration</h4><p>${course.duration}</p></div><div><h4>Frequency</h4><p>${course.frequency}</p></div></div>
                <div style="margin-top:16px;display:flex;gap:8px">
                    <a class="btn btn-secondary btn-small" href="${course.link}">View Course</a>
                    <button class="btn ${getCompletedCourses().includes(course.id) ? "btn-primary" : "btn-secondary"} btn-small" type="button" data-complete-course="${course.id}">
                        ${getCompletedCourses().includes(course.id) ? "Completed ✓" : "Mark completed"}
                    </button>
                </div>
            </article>`).join("");

        const empty = document.getElementById("trainingEmptyState");
        if (empty) {
            if (!courseRoleName) {
                empty.textContent = "Select a role in Role Overview to view applicable training.";
                empty.hidden = false;
                return;
            }

            if (filtered.length === 0) {
                empty.textContent = `No courses are currently assigned to ${courseRoleName}.`;
                empty.hidden = false;
            } else {
                empty.hidden = true;
            }
        }
    }
    const category = document.getElementById("trainingCategory");
    const search = document.getElementById("trainingSearch");
    const update = () => render(category ? category.value : "All", search ? search.value : "");
    if (category) category.addEventListener("change", update);
    if (search) search.addEventListener("input", update);
    container.addEventListener("click", event => {
        const button = event.target.closest("[data-complete-course]");
        if (!button) return;
        const courseId = button.dataset.completeCourse;
        const completed = getCompletedCourses();
        const nextCompleted = completed.includes(courseId)
            ? completed.filter(id => id !== courseId)
            : [...completed, courseId];
        setCompletedCourses(nextCompleted);
        update();
    });
    render();
});
