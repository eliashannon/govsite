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

    const courses = window.PortalData?.courses || [];
    const completionKey = "portal.completedCourses";
    let completedIds = ["TRN-001", "TRN-002"];
    try {
        const stored = JSON.parse(localStorage.getItem(completionKey) || "null");
        if (Array.isArray(stored)) completedIds = stored;
    } catch (error) {
        console.error("Unable to read saved course completions for the dashboard.", error);
    }

    let selectedRole = null;
    try {
        selectedRole = JSON.parse(localStorage.getItem("portal.selectedRole") || "null");
    } catch (error) {
        console.error("Unable to read the saved role for the dashboard.", error);
    }
    const roleCourses = selectedRole?.role
        ? courses.filter(course => Array.isArray(course.roles) && course.roles.includes(selectedRole.role))
        : courses;
    const requiredCourses = roleCourses.filter(course => course.requirement === "Required");
    const completedCourses = roleCourses.filter(course => completedIds.includes(course.id));
    const completedRequired = requiredCourses.filter(course => completedIds.includes(course.id));
    const progress = requiredCourses.length
        ? Math.round((completedRequired.length / requiredCourses.length) * 100)
        : 0;

    document.getElementById("availableCourses").textContent = String(roleCourses.length);
    document.getElementById("completedCourses").textContent = String(completedCourses.length);
    document.getElementById("overallProgress").textContent = `${progress}%`;

    const activeCourseList = document.getElementById("activeCourseList");
    if (activeCourseList) {
        activeCourseList.innerHTML = `
            <div class="dashboard-empty-state">
                <span class="empty-state-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M12 6v6l4 2"></path><circle cx="12" cy="12" r="10"></circle></svg>
                </span>
                <div>
                    <strong>No courses in progress yet</strong>
                    <p>Active course progress is not currently tracked here. Browse the catalog to find your next course.</p>
                    <a class="dashboard-text-link" href="required-training.html">Explore Training Courses →</a>
                </div>
            </div>`;
    }

    const announcementList = document.getElementById("announcementList");
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
