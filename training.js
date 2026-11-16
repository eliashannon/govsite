document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("trainingList");
    if (!container || !window.PortalData) return;
    const courses = window.PortalData.courses;
    const storedRole = JSON.parse(localStorage.getItem("portal.selectedRole") || "null");
    const requestedRole = new URLSearchParams(window.location.search).get("role");
    const roleName = requestedRole || (storedRole && storedRole.role);
    const listTitle = document.getElementById("trainingListTitle");
    const listSubtitle = document.getElementById("trainingListSubtitle");

    function render(filter="All", query="") {
        const roleCourses = roleName
            ? courses.filter(course => Array.isArray(course.roles) && course.roles.includes(roleName))
            : [];

        const filtered = roleCourses.filter(course => {
            const categoryMatch = filter === "All" || course.category === filter;
            const text = [course.title,course.description,course.category,course.requirement].join(" ").toLowerCase();
            return categoryMatch && text.includes(query.toLowerCase());
        });

        if (listTitle) {
            listTitle.textContent = roleName ? `Available Training for ${roleName}` : "Available Training";
        }

        if (listSubtitle) {
            listSubtitle.textContent = roleName
                ? "Review role-based course requirements and applicable learning resources."
                : "Select a role in Role Overview to view applicable training requirements.";
        }

        container.innerHTML = filtered.map(course => `
            <article class="card course-card" data-searchable>
                <div class="card-header"><span class="badge">${course.requirement}</span><span class="badge">${course.category}</span></div>
                <h3>${course.title}</h3><p class="card-description">${course.description}</p>
                <div class="list-item"><div><h4>Estimated Duration</h4><p>${course.duration}</p></div><div><h4>Frequency</h4><p>${course.frequency}</p></div></div>
                <div style="margin-top:16px"><a class="btn btn-secondary btn-small" href="${course.link}">View Course</a></div>
            </article>`).join("");

        const empty = document.getElementById("trainingEmptyState");
        if (empty) {
            if (!roleName) {
                empty.textContent = "Select a role in Role Overview to view applicable training.";
                empty.hidden = false;
                return;
            }

            if (filtered.length === 0) {
                empty.textContent = `No courses are currently assigned to ${roleName}.`;
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
    render();
});
