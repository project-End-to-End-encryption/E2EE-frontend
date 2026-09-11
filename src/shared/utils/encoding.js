export const bufferToBase64 = (buffer) =>{
    const bytes = new Uint8Array(buffer);
    let binary = '';

    for(let i = 0; i < bytes.byteLength; i++){
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

export const base64ToBuffer = (base64) =>{
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);

    for(let i = 0; i < binary.length; i++){
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}