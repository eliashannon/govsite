document.addEventListener("DOMContentLoaded", () => {
    const date = document.getElementById("dashboardDate");
    if (date) {
        const now = new Date();
        date.dateTime = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0")
        ].join("-");
        date.textContent = new Intl.DateTimeFormat(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
        }).format(now);
    }

    let profile = null;
    try {
        profile = JSON.parse(sessionStorage.getItem("govsiteAccountProfile") || "null");
    } catch (error) {
        console.error("Unable to read the signed-in profile for the dashboard.", error);
    }
    const firstName = typeof profile?.firstName === "string" ? profile.firstName.trim() : "";
    const lastName = typeof profile?.lastName === "string" ? profile.lastName.trim() : "";
    const isSignedIn = Boolean(firstName && lastName);
    const welcomeTitle = document.getElementById("welcomeTitle");
    const welcomeSubtitle = document.querySelector(".welcome-subtitle");
    if (welcomeTitle) {
        welcomeTitle.textContent = isSignedIn
            ? `Welcome back, ${firstName} ${lastName}!`
            : "Welcome!";
    }
    if (welcomeSubtitle) {
        welcomeSubtitle.textContent = isSignedIn
            ? "Here's your training overview."
            : "Sign in to access your personalized training information.";
    }

    const availableCoursesElement = document.getElementById("availableCourses");
    const completedCoursesElement = document.getElementById("completedCourses");
    const inProgressCoursesElement = document.getElementById("inProgressCourses");
    const overallProgressElement = document.getElementById("overallProgress");
    const dashboardRoleName = document.getElementById("dashboardRoleName");
    const dashboardRoleDetail = document.getElementById("dashboardRoleDetail");
    const activeCourseList = document.getElementById("activeCourseList");
    const announcementList = document.getElementById("announcementList");
    availableCoursesElement.textContent = "N/A";
    completedCoursesElement.textContent = "N/A";
    inProgressCoursesElement.textContent = "N/A";
    overallProgressElement.textContent = "N/A";

    const setStatDescriptions = descriptions => {
        document.querySelectorAll(".dashboard-stat p").forEach((description, index) => {
            description.textContent = descriptions[index];
        });
    };
    const showUnavailableData = (message, actionHref, actionLabel) => {
        if (activeCourseList) {
            activeCourseList.innerHTML = `
                <div class="dashboard-empty-state">
                    <span class="empty-state-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24"><path d="M12 6v6l4 2"></path><circle cx="12" cy="12" r="10"></circle></svg>
                    </span>
                    <div><strong>N/A</strong><p>${message}</p><a class="dashboard-text-link" href="${actionHref}">${actionLabel}</a></div>
                </div>`;
        }
        if (announcementList) {
            announcementList.innerHTML = '<p class="dashboard-unavailable">N/A</p>';
        }
    };

    if (!isSignedIn) {
        setStatDescriptions(["N/A", "N/A", "N/A", "N/A"]);
        showUnavailableData(
            "Sign in and select a role to view your training information.",
            "account.html",
            "Sign in →"
        );
        return;
    }

    let selectedRole = null;
    try {
        selectedRole = JSON.parse(localStorage.getItem("portal.selectedRole") || "null");
    } catch (error) {
        console.error("Unable to read the saved role for the dashboard.", error);
    }
    const roleName = typeof selectedRole?.role === "string" ? selectedRole.role.trim() : "";
    if (!roleName) {
        dashboardRoleName.textContent = "N/A";
        dashboardRoleDetail.textContent = "Select a role in Role Overview to personalize your dashboard.";
        availableCoursesElement.textContent = "0";
        setStatDescriptions(["Select a role to view courses", "N/A", "N/A", "N/A"]);
        showUnavailableData(
            "Select a role in Role Overview to view your assigned courses and updates.",
            "role-overview.html",
            "Go to Role Overview →"
        );
        return;
    }
    dashboardRoleName.textContent = roleName;
    const roleGroup = [selectedRole.division, selectedRole.branch]
        .filter(value => typeof value === "string" && value.trim())
        .join(" · ");
    dashboardRoleDetail.textContent = roleGroup || "Your selected training role";

    const courses = window.PortalData?.courses || [];
    const roleCourses = courses.filter(course =>
        Array.isArray(course.roles) && course.roles.includes(roleName)
    );
    const completionKey = "portal.completedCourses";
    let completedIds = ["TRN-001", "TRN-002"];
    try {
        const stored = JSON.parse(localStorage.getItem(completionKey) || "null");
        if (Array.isArray(stored)) completedIds = stored;
    } catch (error) {
        console.error("Unable to read saved course completions for the dashboard.", error);
    }

    let inProgressIds = [];
    try {
        const stored = JSON.parse(localStorage.getItem("portal.inProgressCourses") || "null");
        if (Array.isArray(stored)) {
            inProgressIds = stored;
        } else if (stored !== null) {
            console.error("Saved in-progress course data is not a list.");
        }
    } catch (error) {
        console.error("Unable to read in-progress courses for the dashboard.", error);
    }

    const requiredCourses = roleCourses.filter(course => course.requirement === "Required");
    const completedCourses = roleCourses.filter(course => completedIds.includes(course.id));
    const completedRequired = requiredCourses.filter(course => completedIds.includes(course.id));
    const activeCourses = roleCourses.filter(course =>
        inProgressIds.includes(course.id) && !completedIds.includes(course.id)
    );
    const progress = requiredCourses.length
        ? Math.round((completedRequired.length / requiredCourses.length) * 100)
        : null;

    availableCoursesElement.textContent = String(roleCourses.length);
    completedCoursesElement.textContent = String(completedCourses.length);
    inProgressCoursesElement.textContent = String(activeCourses.length);
    overallProgressElement.textContent = progress === null ? "N/A" : `${progress}%`;
    setStatDescriptions([
        `Courses assigned to ${roleName}`,
        "Courses marked complete",
        "Courses you've started",
        "Required course completion"
    ]);

    if (activeCourseList) {
        if (activeCourses.length) {
            const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            })[character]);
            activeCourseList.innerHTML = activeCourses.map(course => {
                const courseHref = course.link && course.link !== "#" ? course.link : "required-training.html";
                return `
                    <article class="active-course-card" data-searchable>
                        <span class="active-course-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"></path></svg>
                        </span>
                        <div class="active-course-copy">
                            <h3>${escapeHtml(course.title)}</h3>
                            <p>${escapeHtml(course.description)}</p>
                            <div class="course-progress-meta"><span>Course status</span><strong>In Progress</strong></div>
                        </div>
                        <a class="continue-course-button" href="${escapeHtml(courseHref)}">Continue Course</a>
                    </article>`;
            }).join("");
        } else {
            activeCourseList.innerHTML = `
                <div class="dashboard-empty-state">
                    <span class="empty-state-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24"><path d="M12 6v6l4 2"></path><circle cx="12" cy="12" r="10"></circle></svg>
                    </span>
                    <div>
                        <strong>No courses in progress</strong>
                        <p>Start a course from your role's training catalog and it will appear here.</p>
                        <a class="dashboard-text-link" href="required-training.html">Explore Training Courses →</a>
                    </div>
                </div>`;
        }
    }

    if (announcementList && window.PortalData) {
        announcementList.innerHTML = window.PortalData.announcements.map(announcement => `
            <article class="dashboard-announcement" data-searchable>
                <span class="announcement-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M12 3 2 8l10 5 10-5-10-5Z"></path><path d="m2 12 10 5 10-5M2 16l10 5 10-5"></path></svg>
                </span>
                <div class="announcement-copy">
                    <h3>${announcement.title}</h3>
                    <p>${announcement.description}</p>
                    <time>${announcement.date}</time>
                    <span class="announcement-type">${announcement.type}</span>
                </div>
            </article>`).join("");
    }
});
