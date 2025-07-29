const githubhash = "fff2af4";

document.addEventListener('DOMContentLoaded', main);

async function main() {
	// Check the hash, if they don't match, we need to cache-bust
	if (githubhash != document.getElementById('html').getAttribute('githubhash')) return window.location = `/?githubhash=${githubhash}`;

	// whoami is defined and handled in auth.js
	if (whoami == null) {
		loadReadme('readme');
		return document.getElementById('about').classList.remove('d-none');
	}
	document.getElementById('podmail').classList.remove('d-none');

	document.getElementById('charname').innerHTML = whoami.name;
	document.getElementById('charimg').setAttribute('src', `https://images.evetech.net/characters/${whoami.character_id}/portrait?size=32`);

	setTimeout(updateTime, 0);
	setTimeout(updateTqStatus, 0);

	mail_headers = localStorage.getItem('mail_headers') == null ? {} : JSON.parse(localStorage.getItem('mail_headers'));
	folders = localStorage.getItem('folders') == null ? {} : JSON.parse(localStorage.getItem('folders'));

	document.getElementById('logout').addEventListener('click', logout);
	document.getElementById('backToFolder').addEventListener('click', backToFolder);

	await pm_fetchFolders();
	await pm_fetchHeaders();
	setTimeout(loadNames, 1);
}

async function loadReadme(id) {
	let res = await fetch('/README.md');
	document.getElementById(id).innerHTML = marked.parse(await res.text());
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
	try {
		const labels = await doAuthRequest(`https://esi.evetech.net/characters/${whoami.character_id}/mail/labels`);
		for (const label of labels.labels) pm_addFolder(label, false);

		const subs = await doAuthRequest(`https://esi.evetech.net/characters/${whoami.character_id}/mail/lists`);
		for (const sub of subs) pm_addFolder(sub, true);
	} catch (e) {
		console.log(e);
	} finally {
		setTimeout(pm_fetchFolders, 300000);
	}
}

async function pm_addFolder(label, mailing_list = false) {
	let id = (mailing_list ? label.mailing_list_id : label.label_id);
	let id_str = `folder_${id}`;
	let el = document.getElementById(id_str);
	localStorage.setItem(`name-${id}`, label.name);
	if (el == null) {
		let el_name = createEl('span', label.name, `$folder-${id}-name`, 'folder-name');
		let el_count = createEl('span', '', `$folder-${id}-unread`, 'unread_count');

		el = createEl('div', null, id_str, 'folder_label', { folder_id: id }, { click: pm_showMails });
		el.appendChild(el_name);
		el.appendChild(el_count);

		if (id == 1) el.classList.add('folder_selected');
		document.getElementById('folders').appendChild(el);
		labels[`label_${id}`] = { esi: label, el: el };
	}
}

function updateUnreadCounts() {
	let folders = document.getElementsByClassName('folder_label');
	for (const folder of folders) {
		let folder_id = folder.getAttribute('folder_id');
		let unread = document.querySelectorAll(`.folder-${folder_id} .unread`).length;
		if (unread == 0) unread = '';
		document.getElementById(`$folder-${folder_id}-unread`).innerText = unread;
	}
}

async function pm_showMails() {
	showSection('headers_container_full');

	let style = document.getElementById('current_folder');
	style.innerText = '';
	await sleep(1); // clear the folder, let the browser update visuals

	let id = this.getAttribute('folder_id');
	style.innerText = `.folder-${id}.showhide {display: block;}`;

	Array.from(document.getElementsByClassName('folder_selected')).forEach(el => { el.classList.remove('folder_selected') });
	this.classList.add('folder_selected');
}

function backToFolder() {
	console.log('showing folder')
	showSection('headers_container_full');
}

let last_highest_mail_id = 0;
let mail_headers = {};
let folders = {};
async function pm_fetchHeaders() {
	let now = Date.now();
	let total_mails = 0;
	try {
		console.log('Fetching evemail headers');

		let mail_ids = new Set(); // mail_ids to be removed after loading mail headers
		let mail_headers = document.getElementsByClassName('mail_header')
		for (const header of mail_headers) mail_ids.add(header.getAttribute('mail_id'));
		mail_ids.delete(null); // this is out header row, ignore it

		let mails, last_mail_id = -1, high_mail_id = 0;
		do {
			let last_mail_param = (last_mail_id == -1) ? '' : `?last_mail_id=${last_mail_id}`;
			mails = await doAuthRequest(`https://esi.evetech.net/characters/${whoami.character_id}/mail${last_mail_param}`, 'GET', { Accept: 'application/json' });

			for (const mail of mails) {
				mail_headers[mail.mail_id] = mail;
				for (const label_id of mail.labels) {
					if (folders[label_id] == null) folders[label_id] = {};
					if (folders[label_id].mail_ids == null) folders[label_id].mail_ids = [];
					folders[label_id].mail_ids.push(mail.mail_id);
				}
				addMailHeader(mail);
				mail_ids.delete(`${mail.mail_id}`);
			}
			if (mails.length > 0) last_mail_id = mails[mails.length - 1].mail_id;
			total_mails += mails.length;

			if (total_mails >= 500) break;
		} while (mails.length > 0);

		last_highest_mail_id = high_mail_id;
		localStorage.setItem('mail_headers', JSON.stringify(mail_headers));
		localStorage.setItem('folders', JSON.stringify(folders));


		if (mail_ids.size) {
			// Cleanup removed mails
			for (const mail_id of Array.from(mail_ids)) {
				const el = document.querySelector(`[mail_id="${mail_id}"]`);
				if (el) el.remove();
			}
			console.log('Removed', mail_ids.size, 'mails');
		}
	} catch (e) {
		console.log(e);
	} finally {
		console.log('Loaded', total_mails, 'mail headers in', Date.now() - now, 'ms');
		setTimeout(updateUnreadCounts, 0);
		setTimeout(pm_fetchHeaders, 61000);
	}
}

async function addMailHeader(mail) {
	let el = document.getElementById('mail_header_' + mail.mail_id);
	if (el == null) {

		el = createEl('div', '', 'mail_header_' + mail.mail_id, ['mail_header', 'd-flex'], { mail_id: mail.mail_id }, { click: pm_loadMail });

		let classes = ['showhide'];
		for (let id of mail.labels) classes.push(`folder-${id}`);
		for (let recip of mail.recipients) if (recip.recipient_type == 'mailing_list') classes.push(`folder-${recip.recipient_id}`);
		elp = createEl('div', null, null, classes);
		elp.style.order = mail.mail_id;
		elp.appendChild(el);

		el.appendChild(createEl('span', localStorage.getItem(`name-${mail.from}`), null, `from load_name from-${mail.from}`, { from_id: mail.from }));
		el.appendChild(createEl('span', mail.subject, null, 'subject flex-fill'));
		el.appendChild(createEl('span', mail.timestamp.replace('T', ' ').replace(':00Z', ''), null, 'timestamp text-end'));

		document.getElementById('mail_headers').appendChild(elp);
	}
	if (mail.is_read == true) el.classList.remove('unread');
	else el.classList.add('unread');
}

const sections = ['headers_container_full', 'mail_container_full']
function showSection(id) {
	for (const section of sections) setDisplayBlock(section, id == section);
}

function setDisplayBlock(id, visible) {
	console.log(id, visible);
	let el = document.getElementById(id);
	if (el) {
		if (visible) el.classList.remove('d-none');
		else el.classList.add('d-none');
	} else console.error('no such element:', `#${id}`);
}

async function pm_loadMail(mail) {
	mail_id = this.getAttribute ? this.getAttribute('mail_id') : mail.mail_id;
	mail = localStorage.getItem(`mail-${mail_id}`);
	if (false && mail != null) mail = JSON.parse(mail);
	else {
		mail = await doAuthRequest(`https://esi.evetech.net/characters/${whoami.character_id}/mail/${mail_id}`);
		//localStorage.setItem(`mail-${mail_id}`, JSON.stringify(mail));
	}
	if (this.getAttribute) {
		showSection('mail_container_full')

		document.getElementById('mail_body').innerHTML = '';
		await sleep(1); // clear the message, let the browser update visuals

		let from = createEl('span', localStorage.getItem(`name-${mail.from}`), null, `from load_name from-${mail.from}`, { from_id: mail.from });
		let recips = createEl('span', '');
		for (let recip of mail.recipients) {
			recips.appendChild(createEl('span', localStorage.getItem(`name-${recip.recipient_id}`), null, `recipient load_name from-${recip.recipient_id}`, { from_id: recip.recipient_id }));
		}
		let header = `
			Subject: ${mail.subject}<br/>
			From: ${from.innerHTML}<br/>
			Sent: ${mail.timestamp}<br/>
			Recipients: ${recips.innerHTML}
		`;

		let body = adjustTags(mail.body);
		Array.from(document.getElementsByClassName('selected')).forEach(el => { el.classList.remove('selected') });
		this.classList.add('selected');
		document.getElementById('mail_body').innerHTML = `${header}<hr/>${body}`;

		mail.mail_id = mail_id;
		pm_updateReadStatus(mail);
		setTimeout(loadNames, 10);
	}
}

async function pm_updateReadStatus(mail, read = true) {
	if (mail.is_read == read) return; // no need to change anything

	console.log('Marking', mail.mail_id, 'as read:', read);
	let url = `https://esi.evetech.net/characters/${whoami.character_id}/mail/${mail.mail_id}`
	let res = await doAuthRequest(url, 'PUT', { Accept: 'application/json', 'Content-Type': 'Content-Type: application/json' }, JSON.stringify({ labels: mail.labels, read: true }));

	if (res.status == 204) { // Success
		let el = document.querySelector(`[mail_id="${mail.mail_id}"]`);
		if (read) el.classList.remove('unread');
		else el.classList.add('unread');
		updateUnreadCounts();
	}
}

// [1373, 1374, 1375, 1376, 1377, 1378, 1379, 1380, 1381, 1382, 1383, 1384, 1385, 1386, 34574]
// https://github.com/joaomlneto/jitaspace/blob/d3d0969245fae4f6263931f8237803b8af6da3ca/packages/tiptap-eve/Extensions/EveLink.ts#L12C1-L15C3
function adjustTags(html) {
	return html
		.replace(/ style="/gi, ' stile="')
		.replace(/ size="/gi, ' syze="')
		//.replace(/ color="/gi, ' colour="')
		.replace(/ color="#ff/gi, ' color="')
		.replace(/ color="#000000/gi, ' color="#222222')
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
	await sleep(1); // allow the UI to update
	let els = document.getElementsByClassName('load_name');
	let fetch_names = [];
	for (const el of els) {
		let from_id = parseInt(el.getAttribute('from_id'));

		if (el.innerHTML != null && el.innerHTML.length > 0) {
			el.classList.remove('load_name');
		}
		else if (localStorage.getItem(`name-${from_id}`) != null) {
			el.innerHTML = localStorage.getItem(`name-${from_id}`);
			el.classList.remove('load_name');
		}
		else if (fetch_names.includes(from_id) == false) fetch_names.push(from_id);
	}
	await fetchNames(fetch_names);
	setTimeout(loadNames, 1000);
}

async function fetchNames(fetch_names) {
	try {
		if (fetch_names.length > 0) {
			console.log('Fetching', fetch_names.length, 'names');
			let names = await doAuthRequest('https://esi.evetech.net/universe/names', 'POST', { Accept: 'application/json', 'Content-Type': 'Content-Type: application/json' }, JSON.stringify(fetch_names))
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

async function updateTqStatus() {
	let status = await doRequest('https://esi.evetech.net/status/');
	let data = await status.json();
	setTqStatus(data);
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

function handleInflight(numInflight) {
	if (numInflight == 0) document.getElementById('inflight_spinner').classList.add('d-none');
	else document.getElementById('inflight_spinner').classList.remove('d-none');
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function handleEsiIssue() {
	setTimeout(clearEsiIssue, 62000);
	document.getElementById('esi_issue').classList.remove('d-none');
}

function clearEsiIssue() {
	document.getElementById('esi_issue').classList.add('d-none');
}