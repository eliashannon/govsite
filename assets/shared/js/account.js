document.addEventListener("DOMContentLoaded", () => {
    const accountsKey = "govsitePrototypeAccounts";
    const legacyCredentials = {
        email: "elias@navy.mil",
        password: "elias"
    };
    // Public, synthetic credentials for this browser-only prototype, never production authentication.
    const demoCredentials = {email: "demo@navy.mil", password: "demo"};
    const signInForm = document.getElementById("signInForm");
    const signInNotice = document.getElementById("signInNotice");
    const createAccountForm = document.getElementById("createAccountForm");
    const createAccountNotice = document.getElementById("createAccountNotice");
    const signInPanel = document.getElementById("sign-in");
    const createAccountPanel = document.getElementById("create-account");
    const pageTitle = document.getElementById("accountPageTitle");
    const pageDescription = document.getElementById("accountPageDescription");

    const showNotice = (notice, message) => {
        notice.textContent = message;
        notice.hidden = false;
    };
    const loadAccounts = () => {
        const accounts = JSON.parse(localStorage.getItem(accountsKey) || "[]");
        if (!Array.isArray(accounts)) throw new Error("Invalid account storage");
        return accounts;
    };
    const validAccount = account => account && typeof account === "object"
        && typeof account.email === "string" && account.email.trim()
        && typeof account.firstName === "string" && account.firstName.trim()
        && typeof account.lastName === "string" && account.lastName.trim()
        && typeof account.salt === "string" && /^[0-9a-f]{32}$/.test(account.salt)
        && typeof account.hash === "string" && /^[0-9a-f]{64}$/.test(account.hash);
    const toHex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    const hashPassword = async (password, salt) => {
        const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
        const bytes = new Uint8Array(salt.match(/../g).map(pair => parseInt(pair, 16)));
        const hash = await crypto.subtle.deriveBits({name: "PBKDF2", salt: bytes, iterations: 120000, hash: "SHA-256"}, key, 256);
        return toHex(new Uint8Array(hash));
    };
    const enterPortal = (profile, destination) => {
        window.PortalAuth.startSession(profile);
        window.location.replace(destination);
    };
    const showAccountPanel = (shouldFocus = false) => {
        const creatingAccount = window.location.hash === "#create-account";
        if (signInPanel) signInPanel.hidden = creatingAccount;
        if (createAccountPanel) createAccountPanel.hidden = !creatingAccount;
        if (pageTitle) {
            pageTitle.textContent = creatingAccount ? "Create an account" : "Sign in";
            if (shouldFocus) pageTitle.focus();
        }
        if (pageDescription) {
            pageDescription.textContent = creatingAccount
                ? "Enter the requested details to get started."
                : "Sign in to access your training portal account and personalized resources.";
        }
        document.title = `Training Portal | ${creatingAccount ? "Create an Account" : "Sign In"}`;
    };

    if (signInForm && signInNotice) {
        signInForm.addEventListener("submit", async event => {
            event.preventDefault();
            if (!signInForm.reportValidity()) return;
            const email = document.getElementById("email").value.trim().toLowerCase();
            const password = document.getElementById("password").value;
            signInNotice.hidden = true;
            try {
                let profile = null;
                if (email === legacyCredentials.email && password === legacyCredentials.password) {
                    profile = {firstName: "Elias", lastName: "Hannon", email, isMaster: true};
                } else if (email === demoCredentials.email && password === demoCredentials.password) {
                    profile = {firstName: "Demo", lastName: "User", email};
                } else {
                    const account = loadAccounts().find(item => validAccount(item) && item.email.toLowerCase() === email);
                    if (account && await hashPassword(password, account.salt) === account.hash) {
                        profile = {firstName: account.firstName, lastName: account.lastName, email: account.email};
                    }
                }
                if (!profile) {
                    showNotice(signInNotice, "Invalid username or password.");
                    return;
                }
                const next = new URLSearchParams(window.location.search).get("next");
                enterPortal(profile, window.PortalAuth.safeDestination(next));
            } catch (error) {
                console.error("Unable to sign in using browser storage.");
                showNotice(signInNotice, "Unable to sign in. Check browser storage and try again.");
            }
        });
        document.getElementById("demoSignIn").addEventListener("click", () => {
            document.getElementById("email").value = demoCredentials.email;
            document.getElementById("password").value = demoCredentials.password;
            signInForm.requestSubmit();
        });
    }

    if (createAccountForm && createAccountNotice) {
        let creatingAccount = false;
        const passcode = createAccountForm.elements.namedItem("passcode");
        const confirmPasscode = createAccountForm.elements.namedItem("confirmPasscode");
        const validatePasscodes = () => {
            confirmPasscode.setCustomValidity(
                confirmPasscode.value && confirmPasscode.value !== passcode.value ? "Passcodes must match." : ""
            );
        };
        passcode.addEventListener("input", validatePasscodes);
        confirmPasscode.addEventListener("input", validatePasscodes);
        createAccountForm.addEventListener("submit", async event => {
            event.preventDefault();
            validatePasscodes();
            if (creatingAccount || !createAccountForm.reportValidity()) return;
            const formData = new FormData(createAccountForm);
            const profile = {
                firstName: formData.get("firstName").trim(),
                lastName: formData.get("lastName").trim(),
                email: formData.get("email").trim().toLowerCase()
            };
            if (!profile.firstName || !profile.lastName || !profile.email) {
                showNotice(createAccountNotice, "Enter all required account details.");
                return;
            }
            createAccountNotice.hidden = true;
            creatingAccount = true;
            try {
                const accounts = loadAccounts();
                if (profile.email === legacyCredentials.email || profile.email === demoCredentials.email
                    || accounts.some(account => account && typeof account.email === "string" && account.email.toLowerCase() === profile.email)) {
                    showNotice(createAccountNotice, "An account with that email already exists. Please sign in.");
                    return;
                }
                const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
                const hash = await hashPassword(passcode.value, salt);
                accounts.push({...profile, salt, hash});
                localStorage.setItem(accountsKey, JSON.stringify(accounts));
                enterPortal(profile, "index.html");
            } catch (error) {
                console.error("Unable to create the browser account or session.");
                showNotice(createAccountNotice, "Unable to create the account or sign in. Check browser storage and try again.");
            } finally {
                creatingAccount = false;
            }
        });
    }
    if (signInPanel && createAccountPanel) {
        showAccountPanel();
        window.addEventListener("hashchange", () => showAccountPanel(true));
    }

    const button = document.getElementById("accountButton");
    const menu = document.getElementById("accountMenu");
    const profile = window.PortalAuth.readSession();
    if (!button || !menu || !profile) return;
    const name = [profile.firstName, profile.lastName].join(" ");
    const avatar = button.querySelector(".account-avatar");
    const label = button.querySelector("span:last-child");
    if (avatar) avatar.textContent = name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
    if (label) label.textContent = `${name} ▾`;
    button.setAttribute("aria-label", `Account menu for ${name}`);
    menu.setAttribute("aria-label", "Account menu");

    const closeMenu = returnFocus => {
        menu.hidden = true;
        button.setAttribute("aria-expanded", "false");
        if (returnFocus) button.focus();
    };
    const signOut = document.createElement("button");
    signOut.type = "button";
    signOut.dataset.signOut = "true";
    signOut.className = "account-menu-action";
    signOut.textContent = "Sign Out";
    signOut.addEventListener("click", () => {
        try {
            window.PortalAuth.signOut();
            closeMenu(false);
        } catch (error) {
            console.error("Unable to clear the browser session.");
            signOut.textContent = "Unable to sign out. Please try again.";
        }
    });
    menu.append(signOut);
    button.addEventListener("click", () => {
        if (!menu.hidden) {
            closeMenu(true);
            return;
        }
        menu.hidden = false;
        button.setAttribute("aria-expanded", "true");
        signOut.focus();
    });
    document.addEventListener("click", event => {
        if (!button.contains(event.target) && !menu.contains(event.target)) closeMenu(menu.contains(document.activeElement));
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !menu.hidden) closeMenu(true);
    });
});
