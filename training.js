document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("trainingList");
    if (!container || !window.PortalData) return;
    const courses = window.PortalData.courses;
    function render(filter="All", query="") {
        const filtered = courses.filter(course => {
            const categoryMatch = filter === "All" || course.category === filter;
            const text = [course.title,course.description,course.category,course.requirement].join(" ").toLowerCase();
            return categoryMatch && text.includes(query.toLowerCase());
        });
        container.innerHTML = filtered.map(course => `
            <article class="card course-card" data-searchable>
                <div class="card-header"><span class="badge">${course.requirement}</span><span class="badge">${course.category}</span></div>
                <h3>${course.title}</h3><p class="card-description">${course.description}</p>
                <div class="list-item"><div><h4>Estimated Duration</h4><p>${course.duration}</p></div><div><h4>Frequency</h4><p>${course.frequency}</p></div></div>
                <div style="margin-top:16px"><a class="btn btn-secondary btn-small" href="${course.link}">View Course</a></div>
            </article>`).join("");
        const empty = document.getElementById("trainingEmptyState");
        if (empty) empty.hidden = filtered.length !== 0;
    }
    const category = document.getElementById("trainingCategory");
    const search = document.getElementById("trainingSearch");
    const update = () => render(category ? category.value : "All", search ? search.value : "");
    if (category) category.addEventListener("change", update);
    if (search) search.addEventListener("input", update);
    render();
});
