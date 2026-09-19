/**
 * MASTER BACKUP KEY
 */

let mbk = null;
let waiters = [];

export const mbkStore = {
    set(bytes){
        mbk = bytes;
        const pending = waiters;
        waiters = [];
        for(const resolve of pending) resolve(bytes);
    },
    get(){return mbk;},

    has(){return mbk !== null;},

    async require(){
        if(!mbk){
            const error = new Error('MBK_NOT_LOADED');
            error.code = 'MBK_NOT_LOADED';
            throw error;
        }
        return mbk;
    },

    waitFor({timeout = 120000 } = {}){
        if(mbk) return Promise.resolve(mbk);

        return new Promise((resolve,reject) => {
            const timer = setTimeout(() => {
                waiters = waiters.filter((w) => w !== onReady);
                reject(new Error('MBK_TIMEOUT'));
            }, timeout);

            const onReady = (bytes) => {clearTimeout(timeout); resolve(bytes);};
            waiters.push(onReady);
        });
    },
    clear(){
        if(mbk) mbk.fill(0);
        mbk = null;
        waiters = [];
    }
};