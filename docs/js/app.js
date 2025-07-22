document.addEventListener('DOMContentLoaded', exec);

let whoami = null;
let authed_json = null;
let db = null;
async function exec() {
    whoami = localStorage.getItem('whoami');
    if (whoami == null) return startLogin();

    whoami = JSON.parse(whoami);
    whoami.character_id = whoami.sub.replace('CHARACTER:EVE:', '');
    user_agent = `PodMail (Character: ${whoami.name} / ${whoami.character_id})`;

    authed_json = JSON.parse(localStorage.getItem('authed_json'));

    document.getElementById('charname').innerHTML = whoami.name;
    document.getElementById('charimg').setAttribute('src', `https://images.evetech.net/characters/${whoami.character_id}/portrait?size=32`);
    
	setTimeout(updateTime, 0);
	setTimeout(updateTqStatus, 0);

    console.log(whoami);
    indexedDB.deleteDatabase('podmail');

    //db = new SimpleDB('podmail', 'evemails');
    //await db.init();

    await pm_fetchLabels();
	document.getElementById('label_1').click();
}

const timeouts = {};
function addTimeout(f, timeout) {
	clearTimeout(timeouts[f.name]); // clear existing timeout for same function name
	timeouts[f.name] = _setTimeout(f, timeout);
}
const _setTimeout = setTimeout;
setTimeout = addTimeout;

function fail(res) {
    console.error(res);
}

let labels = {};
let current_label = -1;
async function pm_fetchLabels() {
	const labels = await doGetAuthRequest(`https://esi.evetech.net/characters/${whoami.character_id}/mail/labels`);
	for (let i = 0; i < labels.labels.length; i++) {
		addLabel(labels.labels[i]);
	}
}

async function addLabel(label) {
	let el = document.getElementById('label_' + label.label_id);
	if (el == null) {
		console.log('adding label', label.name);
		el = document.createElement('div');
		el.setAttribute('id', 'label_' + label.label_id);
		el.classList.add('mail_label');
		el.innerHTML = label.name;
		el.onclick = pm_fetchMails;
		document.getElementById('items').appendChild(el);
		labels['label_' + label.label_id] = {esi: label, el: el};
	}
}

async function pm_fetchMails() {
	let id = this.getAttribute('id');
	let label = labels[id];
	let label_id = label.esi.label_id;
	current_label = label_id;
	const mails = await doGetAuthRequest(`https://esi.evetech.net/characters/${whoami.character_id}/mail?labels=${label_id}`);
	console.log(mails);
}

function getTime() {
	const nowUTC = new Date();
	return nowUTC.getUTCHours().toString().padStart(2, '0') + ':' + nowUTC.getUTCMinutes().toString().padStart(2, '0') + ' UTC';
}

function updateTime() {
	document.getElementById('utcClock').innerHTML = getTime();
	let seconds = new Date().getUTCSeconds();
	setTimeout(updateTime, 1000 * (60 - seconds));
}

function updateTqStatus() {
	doGetJSON('https://esi.evetech.net/status/', setTqStatus);
}

let tqstatusid = -1;
function setTqStatus(data) {
	try {
		if (data == null || data.players == null) return;
		const tqStatus = document.getElementById('tqStatus');
		if (data.players >= 500) {
			tqStatus.innerHTML = ' TQ ONLINE';
			tqStatus.classList.add('online');
			tqStatus.classList.remove('offline');
		} else {
			tqStatus.innerHTML = ' TQ OFFLINE';
			tqStatus.classList.remove('online');
			tqStatus.classList.add('offline');
		}
	} finally {
		const nowUTC = new Date();
		let seconds = nowUTC.getUTCSeconds();
		clearTimeout(tqstatusid);
		tqstatus = setTimeout(updateTqStatus, 1000 * (60 - seconds));
	}
}

let inflight = 0;
function doGetJSON(path, f, params = {}) {
	console.log(getTime(), 'fetching', path);
	const xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {
		if (xhr.readyState === 4 && xhr.status < 400) f(JSON.parse(xhr.responseText), path, params);
		else if (xhr.readyState == 4) {
			console.log(xhr.status, path);
		}
	};
	xhr.onloadend  = function() { 
		inflight--;
		if (inflight == 0) document.getElementById('inflight_spinner').classList.add('d-none');
	};
	xhr.open('GET', path);
	xhr.send();
	inflight++;
	document.getElementById('inflight_spinner').classList.remove('d-none');
}
