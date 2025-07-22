const eve_sso_client_id = 'c53caf7892b14b71bd305b1997fe58fb';
const eve_sso_callback_url = window.location.protocol + '//' + window.location.hostname + (window.location.port == 80 || window.location.port == 443 ? '' : ':' + window.location.port) + '/auth.html';
const eve_sso_scopes_array = ["publicData","esi-mail.organize_mail.v1","esi-mail.read_mail.v1","esi-mail.send_mail.v1"];
const eve_sso_scopes = eve_sso_scopes_array.join(' ');

const eve_sso_auth_url = 'https://login.eveonline.com/v2/oauth/authorize/';
const eve_sso_token_url = 'https://login.eveonline.com/v2/oauth/token';

const eve_mails_labels =  `https://esi.evetech.net/characters/:character_id:/mail/labels`;


const mimetype_form =  {'Content-Type': 'application/x-www-form-urlencoded'};

let user_agent = 'PodMail (auth in progress)';

document.addEventListener('DOMContentLoaded', exec);

async function exec() {
    switch (window.location.pathname) {
        case '/login.html':
            return startLogin();
        case '/auth.html':
            return doAuth();
        case '/logout.html':
            return logout();
    }
}

function logout() {
    localStorage.removeItem('whoami');
    indexedDB.deleteDatabase('podmail');
    window.location = '/';  
}

async function doAuth() {
    const params = Object.fromEntries(new URLSearchParams(window.location.search));
    if (decodeURIComponent(params.state) != localStorage.getItem('state')) {
        // something went very wrong, try again
        return startLogin();
    }

    const body = {
        grant_type: 'authorization_code',
        code: params.code,
        client_id: eve_sso_client_id,
        code_verifier: localStorage.getItem('code_verifier')
    };

    let res = await doAuthRequest(eve_sso_token_url, 'POST', mimetype_form, body);
    let json = await res.json();
    localStorage.setItem('authed_json', JSON.stringify(json));

    const whoami = parseJwtPayload(json.access_token);
    localStorage.setItem('whoami', JSON.stringify(whoami));

    window.location = '/';
}

async function doGetAuthRequest(url) {
    let headers = {
        Authorization: await getAccessToken(),
        Accept: 'application/json'
    }
    let res = await doAuthRequest(url, 'GET', headers)
    return await res.json();
}

function doAuthRequest(url, method = 'GET', headers = null, body = null) {
    if (headers == null) headers = {};
    headers['User-Agent'] = user_agent;

    let params = {
        method: method,
        headers: headers
    };
    if (body != null) {
        if (typeof body == 'object') params.body = new URLSearchParams(body).toString();
        else params.body = body;
    }

    try {
        console.log(url, params);
        return fetch(url, params);
    } catch (e) {
        console.log(e);
    }
}

async function generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallenge(verifier) {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function startLogin() {
    localStorage.setItem('code_verifier', await generateCodeVerifier());
    localStorage.setItem('code_challenge', await generateCodeChallenge(localStorage.getItem('code_verifier')));
    localStorage.setItem('state', createRandomString(32));

    const params = new URLSearchParams({
        response_type: 'code',
        redirect_uri: eve_sso_callback_url,
        client_id: eve_sso_client_id,
        scope: eve_sso_scopes,
        code_challenge: localStorage.getItem('code_challenge'),
        code_challenge_method: 'S256',
        state: localStorage.getItem('state')
    }).toString();
    return window.location = `${eve_sso_auth_url}?${params}`;
}

function createRandomString(length) {
    if (length == null || length < 0) throw `Invalid length value ${length}`;
    let result = [];
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result.push(characters.charAt(Math.floor(Math.random() * charactersLength)));
    }
    return result.join('');
}

function parseJwtPayload(accessToken) {
  const base64Url = accessToken.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
  const json = atob(padded);
  return JSON.parse(json);
}

async function getAccessToken() {
    if (localStorage.getItem('access_token') == 'undefined') localStorage.removeItem('access_token');
    let access_token_expires = parseInt(localStorage.getItem('access_token_expires') || '0');
    if (access_token_expires < Date.now() || localStorage.getItem('access_token') == null) {
        const body = {
            grant_type: 'refresh_token',
            refresh_token: authed_json.refresh_token,
            client_id: eve_sso_client_id
        };
        console.log('Fetching new access token!');
        let res = await doAuthRequest(eve_sso_token_url, 'POST', mimetype_form, body);
        let json = await res.json();
        
        console.log(json);
        localStorage.setItem('access_token', json.access_token);
        localStorage.setItem('access_token_expires', Date.now() + (1000 * (json.expires_in - 2)));
    }
    return localStorage.getItem('access_token');
}

let clear_access_token_id = -1;
function clearAccessToken() {
    clearTimeout(clear_access_token_id);
    access_token = null;
}