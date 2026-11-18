(() => {
    const key = "govsiteAccountProfile";
    const base = new URL("../../..", document.currentScript.src);
    const pages = new Set([
        "index.html", "role-overview.html", "required-training.html", "training.html",
        "key-references.html", "tqs-support.html", "faq.html", "contact.html",
        "ai-training-content-manager.html"
    ]);

    function readSession() {
        try {
            const profile = JSON.parse(sessionStorage.getItem(key) || "null");
            if (!profile || typeof profile !== "object" || Array.isArray(profile)
                || typeof profile.email !== "string" || !profile.email.trim()
                || typeof profile.firstName !== "string" || !profile.firstName.trim()
                || typeof profile.lastName !== "string" || !profile.lastName.trim()) return null;
            return profile;
        } catch (error) {
            console.error("Unable to read the browser session.", error);
            return null;
        }
    }

    function safeDestination(value) {
        if (typeof value !== "string" || !value || /^[a-z][a-z0-9+.-]*:/i.test(value)
            || value.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(value)) return "index.html";
        try {
            const url = new URL(value, base);
            const relative = url.pathname.slice(base.pathname.length);
            if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)
                || !pages.has(relative)) return "index.html";
            return relative + url.search + url.hash;
        } catch (error) {
            console.error("Unable to interpret the requested page.", error);
            return "index.html";
        }
    }

    function enforce() {
        const current = new URL(window.location.href);
        const relative = current.pathname.slice(base.pathname.length);
        const isAccount = relative === "account.html";
        const session = readSession();
        document.documentElement.style.visibility = "";
        if (isAccount) {
            if (session && current.searchParams.get("switch") !== "1") {
                document.documentElement.style.visibility = "hidden";
                window.location.replace(new URL("index.html", base).href);
            }
            return;
        }
        if (!session) {
            document.documentElement.style.visibility = "hidden";
            const signIn = new URL("account.html", base);
            const destination = relative ? relative + current.search + current.hash : "index.html";
            signIn.searchParams.set("next", safeDestination(destination));
            window.location.replace(signIn.href);
        }
    }

    window.PortalAuth = Object.freeze({readSession, safeDestination, enforce});
    enforce();
    window.addEventListener("pageshow", event => { if (event.persisted) enforce(); });
})();
