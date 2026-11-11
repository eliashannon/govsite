document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById("sidebar");
    const pageTitle = document.getElementById("pageTitle");
    const currentPage = document.body.dataset.page || "dashboard";
    const items = [
        {label:"Dashboard",icon:"⌂",href:"index.html",page:"dashboard"},
        {label:"Training Center",icon:"▤",href:"training.html",page:"training"},
        {label:"Role Overview",icon:"▣",href:"role-overview.html",page:"role-overview"},
        {label:"Training Courses",icon:"▥",href:"required-training.html",page:"required-training"},
        {label:"TQS Support",icon:"◉",href:"tqs-support.html",page:"tqs-support"},
        {label:"References",icon:"▧",href:"key-references.html",page:"references"},
        {label:"Contact",icon:"✉",href:"contact.html",page:"contact"}
    ];
    const titles = {dashboard:"Dashboard",training:"Training Center","role-overview":"Role Overview","required-training":"Training Courses","tqs-support":"TQS Support",references:"References",contact:"Contact"};
    if (pageTitle) pageTitle.textContent = titles[currentPage] || "Training Portal";
    if (sidebar) sidebar.innerHTML = `
        <div class="sidebar-brand"><div class="brand-mark">TQ</div><div><div class="brand-name">TQ Portal</div><div class="brand-subtitle">Training & Qualification</div></div></div>
        <nav class="sidebar-nav" aria-label="Main navigation"><div class="nav-label">Main Menu</div>
        ${items.map(item => `<a class="nav-link ${item.page===currentPage?"active":""}" href="${item.href}" ${item.page===currentPage?'aria-current="page"':""}><span class="nav-icon" aria-hidden="true">${item.icon}</span><span>${item.label}</span></a>`).join("")}</nav>
        <div class="sidebar-footer">Internal Training Resource<br><span data-build-version></span></div>`;
    const menuButton = document.getElementById("mobileMenuButton");
    if (menuButton && sidebar) {
        menuButton.addEventListener("click", () => sidebar.classList.toggle("open"));
        document.addEventListener("click", event => {
            if (window.innerWidth <= 760 && !sidebar.contains(event.target) && !menuButton.contains(event.target)) sidebar.classList.remove("open");
        });
    }
});
