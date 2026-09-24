export const authStore = {
    setUserId: (userId) => {
        localStorage.setItem('id',userId);
    },
    getUserId: () => {
        const userId = localStorage.getItem('id');
        if(!userId) throw new Error('No user currently logged in');
        return userId;
    },
    clear: () => {
        localStorage.removeItem('id');
    }
}