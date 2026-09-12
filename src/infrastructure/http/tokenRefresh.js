const API_BASE_LINK = import.meta.env.VITE_API_BASE_URL;

let refreshPromise = null;

export function refreshAccessToken(){
    if(!refreshPromise){
        refreshPromise = fetch(`${API_BASE_LINK}/api/v1/auth/refresh`,{
            method: 'POST',
            credentials: 'include'
        })
            .then((res) =>{
                if(!res.ok){
                    throw new Error('REFRESH_FAILED');
                }
                return res.json();
            }).finally(()=>{
                refreshPromise = null;
            });
    }
    return refreshPromise;
}