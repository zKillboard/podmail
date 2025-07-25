const localhost = window.location.hostname == 'localhost';

const eve_sso_client_id = localhost ? 'c53caf7892b14b71bd305b1997fe58fb' : '82427996be1a4b23aa65175880599c96';
const eve_sso_callback_url = window.location.protocol + '//' + window.location.hostname + (window.location.port == '' ? '' : ':' + window.location.port) + '/auth.html';
const eve_sso_scopes_array = ["publicData","esi-mail.organize_mail.v1","esi-mail.read_mail.v1","esi-mail.send_mail.v1"];
const eve_sso_scopes = eve_sso_scopes_array.join(' ');

const eve_sso_auth_url = 'https://login.eveonline.com/v2/oauth/authorize/';
const eve_sso_token_url = 'https://login.eveonline.com/v2/oauth/token';

const eve_mails_labels =  `https://esi.evetech.net/characters/:character_id:/mail/labels`;


const mimetype_form =  {'Content-Type': 'application/x-www-form-urlencoded'};

let whoamiinit = localStorage.getItem('whoami') ;
let whoami = whoamiinit == null ? null : JSON.parse(whoamiinit);

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
    localStorage.clear();
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

    let res = await doRequest(eve_sso_token_url, 'POST', mimetype_form, body);
    let json = await res.json();

    whoami = parseJwtPayload(json.access_token);
    whoami.character_id = whoami.sub.replace('CHARACTER:EVE:', '');
    user_agent = `PodMail (Character: ${whoami.name} / ${whoami.character_id})`;

    localStorage.setItem('whoami', JSON.stringify(whoami));
    lsSet('whoami', whoami);
    lsSet('authed_json', json);

    window.location = '/';
}

async function doAuthRequest(url, method = 'GET', headers = null, body = null) {
    if (headers == null) headers = {};
    headers.Authorization = await getAccessToken();
    headers.Accept = 'application/json';
    let res = await doRequest(url, method, headers, body);

    if ((res.headers.get('content-type') || '').includes('application/json')) return res.json();
    return res;
}

function doRequest(url, method = 'GET', headers = null, body = null) {
    if (headers == null) headers = {};
    headers['User-Agent'] = whoami ? `PodMail (Character: ${whoami.name} / ${whoami.character_id})` : 'PodMail (auth in progress)';

    let params = {
        method: method,
        headers: headers
    };
    if (body != null) {
        if (typeof body == 'object') params.body = new URLSearchParams(body).toString();
        else params.body = body;
    }

    try {
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
    if (lsGet('access_token') == 'undefined') lsDel('access_token');
    let access_token_expires = parseInt(lsGet('access_token_expires') || '0');
    if (access_token_expires < Date.now() || lsGet('access_token') == null) {
        let authed_json = lsGet('authed_json');
        if (authed_json == null) return logout();
        const body = {
            grant_type: 'refresh_token',
            refresh_token: authed_json.refresh_token,
            client_id: eve_sso_client_id
        };
        console.log('Fetching new access token!');
        let res = await doRequest(eve_sso_token_url, 'POST', mimetype_form, body);
        let json = await res.json();
        
        lsSet('access_token', json.access_token);
        lsSet('access_token_expires', Date.now() + (1000 * (json.expires_in - 2)));
    }
    return lsGet('access_token');
}

let clear_access_token_id = -1;
function clearAccessToken() {
    clearTimeout(clear_access_token_id);
    access_token = null;
}

function lsGet(key) {
	return JSON.parse(localStorage.getItem(`${whoami.character_id}-${key}`));
}

function lsSet(key, value) {
	return localStorage.setItem(`${whoami.character_id}-${key}`, JSON.stringify(value));
}

function lsDel(key) {
	return localStorage.removeItem(`${whoami.character_id}-${key}`, value);
}