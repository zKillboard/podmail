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
	for (const label of labels.labels) addLabel(label, false);
	
	const subs = await doGetAuthRequest(`https://esi.evetech.net/characters/${whoami.character_id}/mail/lists`);
	for (const sub of subs) addLabel(sub, true);
	setTimeout(pm_fetchLabels, 30000);
}

async function addLabel(label, mailing_list = false) {
	let id = (mailing_list ? label.mailing_list_id : label.label_id);
	let el = document.getElementById(`label_${id}`);
	if (el == null) {
		el = createEl('div', null, `label_${id}`, 'mail_label', {label_id: id}, {click: pm_fetchMails});
		document.getElementById('items').appendChild(el);
		labels[`label_${id}`] = {esi: label, el: el};
	}
	el.innerHTML = el.innerHTML = label.name + (label.unread_count > 0 ? ` (${label.unread_count})`: '');;
}

let last_fetchMails_response = '';
async function pm_fetchMails() {
	let id = this.getAttribute('id');
	console.log(id);
	let label = labels[`${id}`];
	let label_id = label.esi.label_id ? label.esi.label_id : label.esi.mailing_list_id;
	current_label = label_id;
	const mails = await doGetAuthRequest(`https://esi.evetech.net/characters/${whoami.character_id}/mail?labels=${label_id}`, 'GET', {Accept: 'application/json'});
	let stringified = JSON.stringify(mails);
	if (last_fetchMails_response != stringified) {
		last_fetchMails_response = stringified;
		document.getElementById('mail_headers').innerHTML = '';
	}
	mails.forEach(addMailHeader);

	loadNames();

	// preload evemails at 4 per second
	let mail_count = 0;
	mails.forEach(mail => {_setTimeout(loadMail.bind(null, mail), 250 * ++mail_count)});
}

async function addMailHeader(mail) {
	let el = document.getElementById('mail_header_' + mail.mail_id);
	if (el == null) {
		el = createEl('div', '', 'mail_header_' + mail.mail_id, 'mail_header', {mail_id: mail.mail_id}, {click: loadMail});

		el.appendChild(createEl('span', localStorage.getItem(`name-${mail.from}`), null, `from load_name from-${mail.from}`, {from_id: mail.from}));
		el.appendChild(createEl('span', mail.subject, null, 'subject'));
		el.appendChild(createEl('span', mail.timestamp.replace('T', ' ').replace(':00Z', ''), null, 'timestamp text-end'));
		// el.appendChild(createEl('span', mail.labels.join(', '), null, 'mail_labels'));

		document.getElementById('mail_headers').appendChild(el);
	}
	if (mail.is_read == true) el.classList.remove('unread');
	else el.classList.add('unread');
}

async function loadMail(mail) {
	mail_id = this.getAttribute ? this.getAttribute('mail_id') : mail.mail_id;
	mail = localStorage.getItem(`mail-${mail_id}`);
	if (mail != null) mail = JSON.parse(mail);
	else {
		mail = await doGetAuthRequest(`https://esi.evetech.net/characters/${whoami.character_id}/mail/${mail_id}`);
		localStorage.setItem(`mail-${mail_id}`, JSON.stringify(mail));
	}
	if (this.getAttribute) {
		let body = adjustTags(mail.body);
		document.getElementById('message').innerHTML = body;
	}
}

function adjustTags(html) {
	return html
		.replace(/ style="/g, ' stile="')
		.replace(/ size="/g, ' syze="')
		.replace(/ color="/g, ' colour="')
		.replace(/\n/g, '<br/>')
		.replace(/href="killReport:/g, 'target=\'_blank\' href="https://zkillboard.com/kill/')
		.replace(/href="showinfo:2\/\//g, 'href="https://evewho.com/corporation/')
		.replace(/href="showinfo:5\/\//g, 'href="https://zkillboard.com/system/')
		.replace(/href="showinfo:1373\/\//g, 'href="https://evewho.com/character/')
		.replace(/href="showinfo:1375\/\//g, 'href="https://evewho.com/character/')
		.replace(/href="showinfo:1376\/\//g, 'href="https://evewho.com/character/')
		.replace(/href="showinfo:1377\/\//g, 'href="https://evewho.com/character/')
		.replace(/href="showinfo:1383\/\//g, 'href="https://evewho.com/character/')
		.replace(/href="showinfo:47466\/\//g, 'href="https://eveconomy.online/item/')
		.replace(/href="http/g, 'target=\'_blank\' href="http')
		.replace(/href='http/g, 'target=\'_blank\' href=\'http');
}

async function loadNames() {
	let els = document.getElementsByClassName('load_name');
	let fetch_names = [];
	for (let i = 0; i < els.length; i++) {
		let el = els[i];
		let from_id = parseInt(el.getAttribute('from_id'));

		if (localStorage.getItem(`name-${from_id}`) != null) el.innerHTML = localStorage.getItem(`name-${from_id}`);
		else if (fetch_names.includes(from_id) == false) fetch_names.push(from_id);
	}
	if (fetch_names.length > 0) {
		console.log(fetch_names)
		let res = await doAuthRequest('https://esi.evetech.net/universe/names', 'POST', {Accept: 'application/json', 'Content-Type':  'Content-Type: application/json' }, JSON.stringify(fetch_names))
		let names = await res.json();
		for (const name_record of names) {
			let id = name_record.id;
			let from_els = document.getElementsByClassName(`from-${id}`);
			for (const from_el of from_els) {
				from_el.innerHTML = name_record.name;
				from_el.classList.remove('load_name');
			}
			localStorage.setItem(`name-${id}`, name_record.name);
		}
	}
}

function createEl(tag, innerHTML, id = null, classes = [], attributes = {}, events = {}) {
	let el = document.createElement(tag);
	el.innerHTML = innerHTML;

	if (id != null && id.length > 0) el.id = id;
	
	if (typeof classes == 'string') classes = classes.split(' ');
	classes.forEach(c => { el.classList.add(c) });

	for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value);

	for (const [key, value] of Object.entries(events)) el.addEventListener(key, value);

	return el;
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
