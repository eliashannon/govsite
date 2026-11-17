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
        {label:"Contact / Help",icon:"✉",href:"contact.html",page:"contact"}
    ];
    const quickLinks = [
        {label:"Training Calendar",icon:"🗓",href:"#"},
        {label:"Policy Updates",icon:"📜",href:"#"},
        {label:"FAQ",icon:"?",href:"#"},
        {label:"Pipeline",icon:"#",href:"#",pipeline:true}
    ];
    const titles = {dashboard:"Dashboard",training:"Training Center","role-overview":"Role Overview","required-training":"Training Courses","tqs-support":"TQS Support",references:"References",contact:"Contact"};
    if (pageTitle) pageTitle.textContent = titles[currentPage] || "Training Portal";
    if (sidebar) sidebar.innerHTML = `
        <div class="sidebar-brand"><div class="brand-mark" aria-hidden="true"></div><div><div class="brand-name">Training &<br>Qualification Portal</div></div></div>
        <nav class="sidebar-nav" aria-label="Main navigation"><div class="nav-label">Main Menu</div>
        ${items.map(item => `<a class="nav-link ${item.page===currentPage?"active":""}" href="${item.href}" ${item.page===currentPage?'aria-current="page"':""}><span class="nav-icon" aria-hidden="true">${item.icon}</span><span>${item.label}</span></a>`).join("")}
        <div class="nav-label">Quick Links</div>
        ${quickLinks.map(item => `<a class="nav-link" href="${item.href}"><span class="nav-icon" aria-hidden="true">${item.icon}</span><span>${item.label}${item.pipeline?'<br><small class="nav-pipeline" data-build-pipeline>Pipeline #Local</small>':''}</span></a>`).join("")}
        </nav>
        <div class="sidebar-footer">Internal Training Resource<br><span data-build-version></span></div>`;
    const menuButton = document.getElementById("mobileMenuButton");
    if (menuButton && sidebar) {
        const overlay = document.createElement("button");
        overlay.type = "button";
        overlay.className = "sidebar-overlay";
        overlay.setAttribute("aria-label", "Close navigation");
        overlay.hidden = true;
        sidebar.insertAdjacentElement("afterend", overlay);
        menuButton.setAttribute("aria-controls", "sidebar");

        const closeMenu = () => {
            sidebar.classList.remove("open");
            overlay.hidden = true;
            document.body.classList.toggle("sidebar-collapsed", window.innerWidth > 900);
            menuButton.setAttribute("aria-expanded", "false");
            menuButton.setAttribute("aria-label", "Open navigation");
        };
        const openMenu = () => {
            sidebar.classList.add("open");
            document.body.classList.remove("sidebar-collapsed");
            overlay.hidden = window.innerWidth > 900;
            menuButton.setAttribute("aria-expanded", "true");
            menuButton.setAttribute("aria-label", "Close navigation");
        };

        if (window.innerWidth > 900) {
            openMenu();
        } else {
            closeMenu();
        }

        menuButton.addEventListener("click", () => {
            const isOpen = window.innerWidth <= 900
                ? sidebar.classList.contains("open")
                : !document.body.classList.contains("sidebar-collapsed");
            if (isOpen) {
                closeMenu();
            } else {
                openMenu();
            }
        });
        overlay.addEventListener("click", closeMenu);
        // Let page navigation happen directly; closing the drawer first causes a visible slide-out before the next page loads.
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && sidebar.classList.contains("open")) {
                closeMenu();
                menuButton.focus();
            }
        });
        window.addEventListener("resize", () => {
            if (window.innerWidth > 900) {
                openMenu();
            } else {
                closeMenu();
            }
        });
    }
});
