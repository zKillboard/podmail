document.addEventListener('DOMContentLoaded', main);

async function main() {
	// whoami is defined and handled in auth.js
    if (whoami == null) return document.getElementById('about').classList.remove('d-none');
	document.getElementById('podmail').classList.remove('d-none');

    document.getElementById('charname').innerHTML = whoami.name;
    document.getElementById('charimg').setAttribute('src', `https://images.evetech.net/characters/${whoami.character_id}/portrait?size=32`);
    
	setTimeout(updateTime, 0);
	setTimeout(updateTqStatus, 0);

	mail_headers = localStorage.getItem('mail_headers') == null ? {} : JSON.parse(localStorage.getItem('mail_headers'));
	folders = localStorage.getItem('folders') == null ? {} : JSON.parse(localStorage.getItem('folders'));

	await pm_fetchFolders();
	await pm_fetchHeaders();
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
async function pm_fetchFolders() {
	const labels = await doAuthRequest(`https://esi.evetech.net/characters/${whoami.character_id}/mail/labels`);
	for (const label of labels.labels) pm_addFolder(label, false);
	
	const subs = await doAuthRequest(`https://esi.evetech.net/characters/${whoami.character_id}/mail/lists`);
	for (const sub of subs) pm_addFolder(sub, true);
	setTimeout(pm_fetchFolders, 300000);
}

async function pm_addFolder(label, mailing_list = false) {
	let id = (mailing_list ? label.mailing_list_id : label.label_id);
	let id_str = `folder_${id}`;
	let el = document.getElementById(id_str);
	localStorage.setItem(`name-${id}`, label.name);
	if (el == null) {
		el = createEl('div', null, id_str, 'folder_label', {folder_id: id}, {click: pm_showMails});
		document.getElementById('folders').appendChild(el);
		labels[`label_${id}`] = {esi: label, el: el};
	}
	el.innerHTML = el.innerHTML = label.name + (label.unread_count > 0 ? ` (${label.unread_count})`: '');;
}

function pm_showMails() {
	let style = document.getElementById('current_folder');
	let id = this.getAttribute('folder_id');
	console.log(this);
	style.innerText = `.folder-${id}.showhide {display: block;}`;
}

let last_highest_mail_id = 0;
let mail_headers = {};
let folders = {};
async function pm_fetchHeaders() {
	let now = Date.now();
	let total_mails = 0;
	let mails, last_mail_id = -1, high_mail_id = 0;
	do {
		let last_mail_param = (last_mail_id == -1) ? '' : `?last_mail_id=${last_mail_id}`;
		mails = await doAuthRequest(`https://esi.evetech.net/characters/${whoami.character_id}/mail${last_mail_param}`, 'GET', {Accept: 'application/json'});
		
		for(const mail of mails) {
			mail_headers[mail.mail_id] = mail;
			for (const label_id of mail.labels) {
				if (folders[label_id] == null) folders[label_id] = {};
				if (folders[label_id].mail_ids == null) folders[label_id].mail_ids = [];
				folders[label_id].mail_ids.push(mail.mail_id);
			}
			addMailHeader(mail);
		}
		if (mails.length > 0) last_mail_id = mails[mails.length - 1].mail_id;
		total_mails += mails.length;
		if (total_mails >= 500) break;
	} while (mails.length > 0);

	last_highest_mail_id = high_mail_id;
	localStorage.setItem('mail_headers', JSON.stringify(mail_headers));
	localStorage.setItem('folders', JSON.stringify(folders));

	console.log('Loaded', total_mails, 'mail headers in', Date.now() - now, 'ms');
	loadNames();
}

async function addMailHeader(mail) {
	let el = document.getElementById('mail_header_' + mail.mail_id);
	if (el == null) {
		
		el = createEl('div', '', 'mail_header_' + mail.mail_id, ['mail_header', 'd-flex'], {mail_id: mail.mail_id}, {click: loadMail});
 
		let classes = ['showhide'];
		for (let id of mail.labels) classes.push(`folder-${id}`);
		for (let recip of mail.recipients) if (recip.recipient_type == 'mailing_list') classes.push(`folder-${recip.recipient_id}`);
		elp = createEl('div', null, null, classes)
		elp.appendChild(el);
		
		el.appendChild(createEl('span', localStorage.getItem(`name-${mail.from}`), null, `from load_name from-${mail.from}`, {from_id: mail.from}));
		el.appendChild(createEl('span', mail.subject, null, 'subject flex-fill'));
		el.appendChild(createEl('span', mail.timestamp.replace('T', ' ').replace(':00Z', ''), null, 'timestamp text-end'));
		// el.appendChild(createEl('span', mail.labels.join(', '), null, 'mail_labels'));

		document.getElementById('mail_headers').appendChild(elp);
	}
	if (mail.is_read == true) el.classList.remove('unread');
	else el.classList.add('unread');
}

async function loadMail(mail) {
	mail_id = this.getAttribute ? this.getAttribute('mail_id') : mail.mail_id;
	mail = localStorage.getItem(`mail-${mail_id}`);
	if (mail != null) mail = JSON.parse(mail);
	else {
		mail = await doAuthRequest(`https://esi.evetech.net/characters/${whoami.character_id}/mail/${mail_id}`);
		localStorage.setItem(`mail-${mail_id}`, JSON.stringify(mail));
	}
	if (this.getAttribute) {
		let body = adjustTags(mail.body);
		Array.from(document.getElementsByClassName('selected')).forEach(el => { el.classList.remove('selected')});
		this.classList.add('selected');
		document.getElementById('message').innerHTML = body;
	}
}

// [1373, 1374, 1375, 1376, 1377, 1378, 1379, 1380, 1381, 1382, 1383, 1384, 1385, 1386, 34574]
// https://github.com/joaomlneto/jitaspace/blob/d3d0969245fae4f6263931f8237803b8af6da3ca/packages/tiptap-eve/Extensions/EveLink.ts#L12C1-L15C3
function adjustTags(html) {
	return html
		.replace(/ style="/gi, ' stile="')
		.replace(/ size="/gi, ' syze="')
		.replace(/ color="/gi, ' colour="')
		.replace(/\n/g, '<br/>')
		.replace(/href="killReport:/g, 'target=\'_blank\' href="https://zkillboard.com/kill/')
		.replace(/href="showinfo:2\/\//g, 'href="https://evewho.com/corporation/')
		.replace(/href="showinfo:5\/\//g, 'href="https://zkillboard.com/system/')
		.replace(/href="showinfo:1373\/\//g, 'href="https://evewho.com/character/')
		.replace(/href="showinfo:1374\/\//g, 'href="https://evewho.com/character/')
		.replace(/href="showinfo:1375\/\//g, 'href="https://evewho.com/character/')
		.replace(/href="showinfo:1376\/\//g, 'href="https://evewho.com/character/')
		.replace(/href="showinfo:1377\/\//g, 'href="https://evewho.com/character/')
		.replace(/href="showinfo:1378\/\//g, 'href="https://evewho.com/character/')
		.replace(/href="showinfo:1379\/\//g, 'href="https://evewho.com/character/')
		.replace(/href="showinfo:1380\/\//g, 'href="https://evewho.com/character/')
		.replace(/href="showinfo:1381\/\//g, 'href="https://evewho.com/character/')
		.replace(/href="showinfo:1382\/\//g, 'href="https://evewho.com/character/')
		.replace(/href="showinfo:1383\/\//g, 'href="https://evewho.com/character/')
		.replace(/href="showinfo:1384\/\//g, 'href="https://evewho.com/character/')
		.replace(/href="showinfo:34574\/\//g, 'href="https://evewho.com/character/')
		.replace(/href="showinfo:47466\/\//g, 'href="https://eveconomy.online/item/')
		.replace(/href="http/gi, 'target=\'_blank\' href="http')
		.replace(/href='http/gi, 'target=\'_blank\' href=\'http');
}

async function loadNames() {
	let els = document.getElementsByClassName('load_name');
	let fetch_names = [];
	for (const el of els) {
		let from_id = parseInt(el.getAttribute('from_id'));

		if (localStorage.getItem(`name-${from_id}`) != null) {
			el.innerHTML = localStorage.getItem(`name-${from_id}`);
			el.classList.remove('load_name');
		}
		else if (fetch_names.includes(from_id) == false) fetch_names.push(from_id);
	}
	await fetchNames(fetch_names);
	if (fetch_names.length > 0) setTimeout(loadNames, 1000);
}

async function fetchNames(fetch_names) {
	try {
		if (fetch_names.length > 0) {
			console.log('Fetching', fetch_names.length, 'names');
			let names = await doAuthRequest('https://esi.evetech.net/universe/names', 'POST', {Accept: 'application/json', 'Content-Type':  'Content-Type: application/json' }, JSON.stringify(fetch_names))
			for (const name_record of names) applyNameToId(name_record);
		}
	} catch (e) {
		await sleep(2500);
		if (fetch_names.length > 1) {
			const middle = Math.ceil(fetch_names.length / 2);
			await fetchNames(fetch_names.slice(0, middle));
			await fetchNames(fetch_names.slice(middle));
		} else {
			console.log('error fetching name for', fetch_names[0]);
			localStorage.setItem('name-' + fetch_names[0], 'Unknown ID ' + fetch_names[0]);
		}
	}
}

function applyNameToId(name_record) {
	let id = name_record.id;
	let from_els = document.getElementsByClassName(`from-${id}`);
	for (const from_el of from_els) {
		from_el.innerHTML = name_record.name;
		from_el.classList.remove('load_name');
	}
	localStorage.setItem(`name-${id}`, name_record.name);
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}