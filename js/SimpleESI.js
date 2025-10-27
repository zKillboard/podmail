/*
## SimpleESI

### Required Options

- `clientID`  
  The client ID.

- `callbackURL`  
  The full callback URL. e.g. https://yourdomain.com/sso/auth

- `scopes`  
  The scopes.


### Optional Options

- `loginURL`  
  The login URL for your app. Will execute `authBegin` if detected.

- `authURL`  
  The auth/callback URL for your app. Will execute `doAuth`.

- `logoutURL`  
  The logout URL. Will execute `authLogout`.

- `esiInFlightHandler`  
  A custom function that will be called when a ESI call is started and completed, it will be passed the total number of inflight calls count

- `esiIssueHandler`  
  A custom function that will be executed when an issue is found (res.status >= 500), it will be passed res

- `logger`  
  Where to send normal output, defaults to console.log

- `errorlogger`  
  Where to send error output, defaults to console.error

*/

class SimpleESI {
	constructor(options = {}) {
		if (!options.appName) {
			throw 'Option "appName" is required!';
		}

		this.options = options;
		this.ssoClientId = this.getOption('clientID');
		this.callbackUrl = this.getOption('callbackUrl');
		this.scopesArray = this.getOption('scopes');
		this.esiInFlightHandler = this.getOption('esiInFlightHandler', this.noop);
		this.esiIssueHandler = this.getOption('esiIssueHandler', this.noop);
		this.logger = this.getOption('logger', console.log);
		this.errorlogger = this.getOption('errorlogger', console.error);

		this.scopes = this.scopesArray.join(' ');

		this.ssoAuthUrl = 'https://login.eveonline.com/v2/oauth/authorize/';
		this.ssoTokenUrl = 'https://login.eveonline.com/v2/oauth/token';

		const compatability_date = '2020-01-01';

		this.mimetypeForm = {
			'Content-Type': 'application/x-www-form-urlencoded'
		};
		this.mimetypeJson = {
			Accept: 'application/json',
			'X-Compatibility-Date': compatability_date,
			'Content-Type': 'application/json'
		};

		this.inflight = 0;
		this.clearAccessTokenId = -1;

		// user info and cache
		this.whoami = null;
		this.initWhoami();

		// Attach DOM event handlers
		document.addEventListener('DOMContentLoaded', this.domLoaded.bind(this));
	}

	setOption(name, value) {
		this.options[name] = value;
	}

	getOption(name, defaultValue = undefined) {
		if (typeof defaultValue == 'undefined' && typeof this.options[name] == 'undefined') throw `Required option ${name} is not defined!`;
		return this.options[name] ?? defaultValue;
	}

	initWhoami() {
		if (localStorage.getItem('loggedout') === 'true') return null;

		let whoamiinit = localStorage.getItem('whoami');
		this.whoami = whoamiinit == null ? null : JSON.parse(whoamiinit);
	}

	async domLoaded() {
		switch (window.location.pathname) {
			case this.getOption('loginURL', '/login.html'):
				return this.authBegin();
			case this.getOption('authURL', '/auth.html'):
				return this.authCallback();
			case this.getOption('logoutURL', '/logout.html'):
				return this.authLogout();
		}
	}

	authLogout(desctructive = true) {
		if (desctructive) localStorage.clear();
		else localStorage.setItem('loggedout', 'true');

		window.location = '/';
		return false;
	}

	async authCallback() {
		const params = Object.fromEntries(new URLSearchParams(window.location.search));
		if (decodeURIComponent(params.state) !== localStorage.getItem('state')) {
			// Something went very wrong, try again
			return this.authBegin();
		}

		const body = {
			grant_type: 'authorization_code',
			code: params.code,
			client_id: this.ssoClientId,
			code_verifier: localStorage.getItem('code_verifier')
		};

		let res = await this.doRequest(this.ssoTokenUrl, 'POST', this.mimetypeForm, body);
		let json = await res.json();

		this.whoami = this.parseJwtPayload(json.access_token);
		this.whoami.character_id = this.whoami.sub.replace('CHARACTER:EVE:', '');

		localStorage.setItem('whoami', JSON.stringify(this.whoami));
		localStorage.setItem(`whoami-${this.whoami.character_id}`, JSON.stringify(this.whoami));
		this.lsSet('whoami', this.whoami);
		this.lsSet('authed_json', json);
		localStorage.removeItem('loggedout')

		window.location = '/';
	}

	changeCharacter(character_id) {
		// No change
		if (this.whoami.character_id == character_id) return false;

		const raw_whoami = localStorage.getItem(`whoami-${character_id}`);
		if (!raw_whoami) {
			throw `${character_id} is not an authenticated character!`;
		}

		const next_whoami = JSON.parse(raw_whoami);
		if (!next_whoami) {
			throw `${character_id} is not an authenticated character!`;
		}

		this.whoami = next_whoami;
		localStorage.setItem('whoami', raw_whoami);
		this.initWhoami();
		return true;
	}

	async doJsonAuthRequest(url, method = 'GET', headers = null, body = null) {
		let res = await this.doAuthRequest(url, method, headers, body);
		return await res.json();
	}

	async doAuthRequest(url, method = 'GET', headers = null, body = null) {
		if (headers == null) headers = {};
		headers.Authorization = await this.getAccessToken();
		headers.Accept = 'application/json';
		return await this.doRequest(url, method, headers, body);
	}

	async doJsonRequest(url, method = 'GET', headers = null, body = null) {
		let res = await this.doRequest(url, method, headers, body);
		return await res.json();
	}

	async doRequest(url, method = 'GET', headers = null, body = null) {
		if (headers == null) headers = {};
		headers['User-Agent'] = this.whoami
			? `${this.options.appName} (Character: ${this.whoami.name} / ${this.whoami.character_id})`
			: `${this.options.appName} (auth in progress)`;

		let params = {
			method: method,
			headers: headers
		};
		if (body != null) {
			if (typeof body === 'object') params.body = new URLSearchParams(body).toString();
			else params.body = body;
		}

		let res;
		try {
			this.inflight++;
			this.esiInFlightHandler(this.inflight);
			res = await fetch(url, params);
			if (res.status >= 500) this.esiIssueHandler(res);
			return res;
		} catch (e) {
			this.errorlogger(e);
			this.esiIssueHandler(e, res);
		} finally {
			this.inflight--;
			this.esiInFlightHandler(this.inflight);
		}
	}

	async noop() { }

	async generateCodeVerifier() {
		const array = new Uint8Array(32);
		crypto.getRandomValues(array);
		return btoa(String.fromCharCode(...array))
			.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	}

	async generateCodeChallenge(verifier) {
		const data = new TextEncoder().encode(verifier);
		const digest = await crypto.subtle.digest('SHA-256', data);
		const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
		return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	}

	async authBegin() {
		localStorage.setItem('code_verifier', await this.generateCodeVerifier());
		localStorage.setItem('code_challenge', await this.generateCodeChallenge(localStorage.getItem('code_verifier')));
		localStorage.setItem('state', this.createRandomString(32));

		const params = new URLSearchParams({
			response_type: 'code',
			redirect_uri: this.callbackUrl,
			client_id: this.ssoClientId,
			scope: this.scopes,
			code_challenge: localStorage.getItem('code_challenge'),
			code_challenge_method: 'S256',
			state: localStorage.getItem('state')
		}).toString();
		return window.location = `${this.ssoAuthUrl}?${params}`;
	}

	createRandomString(length) {
		if (length == null || length < 0) throw `Invalid length value ${length}`;
		let result = [];
		const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		const charactersLength = characters.length;
		for (let i = 0; i < length; i++) {
			result.push(characters.charAt(Math.floor(Math.random() * charactersLength)));
		}
		return result.join('');
	}

	parseJwtPayload(accessToken) {
		const base64Url = accessToken.split('.')[1];
		const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
		const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
		const json = atob(padded);
		return JSON.parse(json);
	}

	async getAccessToken() {
		if (this.lsGet('access_token') == 'undefined') this.lsDel('access_token');
		let access_token_expires = parseInt(this.lsGet('access_token_expires') || '0');
		if (access_token_expires < Date.now() || this.lsGet('access_token') == null) {
			let authed_json = this.lsGet('authed_json');
			if (authed_json == null) return this.authLogout();
			const body = {
				grant_type: 'refresh_token',
				refresh_token: authed_json.refresh_token,
				client_id: this.ssoClientId
			};
			this.logger('Fetching new access token!');
			let res = await this.doRequest(this.ssoTokenUrl, 'POST', this.mimetypeForm, body);
			let json = await res.json();

			this.lsSet('access_token', json.access_token);
			this.lsSet('access_token_expires', Date.now() + (1000 * (json.expires_in - 2)));
		}
		return this.lsGet('access_token');
	}

	clearAccessToken() {
		clearTimeout(this.clearAccessTokenId);
		this.access_token = null;
	}

	lsGet(key, global = false) {
		let sesiKey = this.createKey(key, global);
		try {
			return JSON.parse(localStorage.getItem(sesiKey));
		} catch (e) {
			return null;
		}
	}

	lsSet(key, value, global = false) {
		let sesiKey = this.createKey(key, global);
		return localStorage.setItem(sesiKey, JSON.stringify(value));
	}

	lsDel(key, global = false) {
		let sesiKey = this.createKey(key, global);
		return localStorage.removeItem(sesiKey);
	}

	createKey(key, global) {
		if (global === false) {
			if (!this.whoami || !this.whoami.character_id) {
				throw 'Not authenticated!';
			}
		}
		const who = global ? 'global' : this.whoami.character_id;
		return `simpleesi-${who}-${key}`;
	}
}