document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById("sidebar");
    const pageTitle = document.getElementById("pageTitle");
    const currentPage = document.body.dataset.page || "dashboard";
    const icon = paths => `<svg aria-hidden="true" viewBox="0 0 24 24">${paths}</svg>`;
    const icons = {
        dashboard: icon('<rect x="3" y="3" width="8" height="8" rx="1.5"></rect><rect x="13" y="3" width="8" height="5" rx="1.5"></rect><rect x="13" y="10" width="8" height="11" rx="1.5"></rect><rect x="3" y="13" width="8" height="8" rx="1.5"></rect>'),
        role: icon('<rect x="3" y="7" width="18" height="14" rx="2"></rect><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"></path>'),
        training: icon('<path d="M12 7v14M3 18V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v13H5a2 2 0 0 0-2 2Z"></path><path d="M8 7h8M8 11h6"></path>'),
        courses: icon('<path d="m2 10 10-5 10 5-10 5-10-5Z"></path><path d="M6 12v5c3.5 3 8.5 3 12 0v-5M22 10v6"></path>'),
        support: icon('<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle><path d="m4.9 4.9 1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4"></path>'),
        references: icon('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"></path>'),
        contact: icon('<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3 7 9 6 9-6"></path>'),
        calendar: icon('<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18M8 14h2m4 0h2m-8 3h2m4 0h2"></path>'),
        updates: icon('<path d="M8 3h8l4 4v14H4V3h4Z"></path><path d="M14 3v5h6M8 12h8M8 16h8"></path>'),
        help: icon('<circle cx="12" cy="12" r="10"></circle><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3m.1 4h.01"></path>'),
        completed: icon('<circle cx="12" cy="12" r="10"></circle><path d="m8 12 3 3 5-6"></path>')
    };
    const items = [
        {label:"Dashboard",icon:icons.dashboard,href:"index.html",page:"dashboard"},
        {label:"Role Overview",icon:icons.role,href:"role-overview.html",page:"role-overview"},
        {label:"Training Courses",icon:icons.courses,href:"required-training.html",page:"required-training"},
        {label:"TQS Support",icon:icons.support,href:"tqs-support.html",page:"tqs-support"},
        {label:"References",icon:icons.references,href:"key-references.html",page:"references"},
        {label:"Contact / Help",icon:icons.contact,href:"contact.html",page:"contact"}
    ];
    const quickLinks = [
        {label:"Training Calendar",icon:icons.calendar,href:"#"},
        {label:"Policy Updates",icon:icons.updates,href:"#"},
        {label:"FAQ",icon:icons.help,href:"#"},
        {label:"Completed Workflows",icon:icons.completed,href:"https://github.com/eliashannon/govsite/actions",workflowCount:true}
    ];
    const titles = {dashboard:"Dashboard","role-overview":"Role Overview","required-training":"Training Courses","tqs-support":"TQS Support",references:"References",contact:"Contact"};
    if (pageTitle) pageTitle.textContent = titles[currentPage] || "Training Portal";
    if (sidebar) sidebar.innerHTML = `
        <div class="sidebar-brand"><div class="brand-mark" aria-hidden="true">${icons.training}</div><div><div class="brand-name">Training &<br>Qualification Portal</div></div></div>
        <nav class="sidebar-nav" aria-label="Main navigation"><div class="nav-label">Main Menu</div>
        ${items.map(item => `<a class="nav-link ${item.page===currentPage?"active":""}" href="${item.href}" ${item.page===currentPage?'aria-current="page"':""}><span class="nav-icon" aria-hidden="true">${item.icon}</span><span>${item.label}</span></a>`).join("")}
        <div class="nav-label">Quick Links</div>
        ${quickLinks.map(item => `<a class="nav-link" href="${item.href}" ${item.workflowCount?'target="_blank" rel="noopener noreferrer"':''}><span class="nav-icon" aria-hidden="true">${item.icon}</span><span>${item.label}${item.workflowCount?'<br><small class="nav-workflow-count" data-workflow-count>Loading…</small>':''}</span></a>`).join("")}
        </nav>
        <div class="sidebar-footer">Internal Training Resource<br><span data-build-version></span></div>`;
    if (window.BuildInfo?.refresh) window.BuildInfo.refresh();
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
