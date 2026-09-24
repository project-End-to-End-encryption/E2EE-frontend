const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function useLogout() {
    try {
        // 1. Tell backend to invalidate/clear refresh token
        await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
        });
    } catch (err) {
        // Even if the server request fails, continue clearing local data.
        console.error("Logout API failed:", err);
    }

    // 2. Clear localStorage
    try {
        localStorage.clear();
    } catch (err) {
        console.error("Failed to clear localStorage:", err);
    }

    // 3. Clear sessionStorage
    try {
        sessionStorage.clear();
    } catch (err) {
        console.error("Failed to clear sessionStorage:", err);
    }

    // 4. Clear IndexedDB databases
    try {
        if (indexedDB.databases) {
            const databases = await indexedDB.databases();

            await Promise.all(
                databases
                    .map((db) => db.name)
                    .filter(Boolean)
                    .map(
                        (name) =>
                            new Promise((resolve) => {
                                const request = indexedDB.deleteDatabase(name);

                                request.onsuccess = resolve;
                                request.onerror = resolve;
                                request.onblocked = resolve;
                            })
                    )
            );
        }
    } catch (err) {
        console.error("Failed to clear IndexedDB:", err);
    }

    // 5. Clear Cache Storage
    try {
        if ("caches" in window) {
            const cacheNames = await caches.keys();

            await Promise.all(
                cacheNames.map((cacheName) => caches.delete(cacheName))
            );
        }
    } catch (err) {
        console.error("Failed to clear Cache Storage:", err);
    }

    // 6. Unregister service workers
    try {
        if ("serviceWorker" in navigator) {
            const registrations =
                await navigator.serviceWorker.getRegistrations();

            await Promise.all(
                registrations.map((registration) =>
                    registration.unregister()
                )
            );
        }
    } catch (err) {
        console.error("Failed to unregister service workers:", err);
    }

    // 7. Go to login and replace history
    window.location.replace("/login");
}