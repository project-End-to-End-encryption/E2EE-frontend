const API_BASE_LINK = import.meta.env.VITE_API_BASE_URL;

async function request(path, body) {
    const res = await fetch(`${API_BASE_LINK}${path}`,{
        method: 'POST',
        headers: {'Content-Type' : 'application/json'},
        credentials: 'include',
        body: JSON.stringify(body)
    });

    const data = await res.json();

    if(!res.ok || !data.success){
        throw new Error(data.message || 'Request Failed');
    }
    return data.data;
}

export const signupUser = ({email, password, reservationId }) =>
    request('/api/v1/auth/signup', {email, password, reservationId});

export const loginUser = ({email, password}) =>
    request('/api/v1/auth/login', {email, password});