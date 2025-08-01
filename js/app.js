const githubhash = "";

document.addEventListener('DOMContentLoaded', main);

async function main() {
	let docgithubhash = document.getElementById('html').getAttribute('githubhash');
	let podmail_version = (await (await (await fetch('/podmail.version?' + Date.now()))).text()).trim()
	// Check the hash, if they don't match, we need to cache-bust
	if (githubhash != docgithubhash || githubhash != podmail_version) return window.location = `/?githubhash=${githubhash}`;

	// This is for localhost testing
	if (githubhash == '') document.getElementById('podmailLink').setAttribute('href', '/?' + Date.now());

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

	setTimeout(doAffiliation, 0);
	await pm_fetchFolders();
	pm_fetchHeaders();

	window.addEventListener('popstate', updateRoute);

	let referrer = decodeURIComponent(new URLSearchParams(window.location.search).get('referrer') || '/folder/1');
	if (referrer != '/') updateRoute(null, referrer);

	document.getElementsByName('compose_recipients')[0].addEventListener('blur', updateComposeRecipients);
	document.getElementsByName('compose_recipients')[0].addEventListener('input', updateComposeRecipients);

	// bind buttons with class btn-bind to a function equivalent to the button's id
	Array.from(document.getElementsByClassName('btn-bind')).forEach((el) => {
		const id = el.id;
		if (id == null || id.trim().length == 0) return console.error('this btn-bind does not have an id', el);
		if (!window[id] || typeof window[id] != 'function') return console.error('button', id, 'does not have a matching function');
		el.addEventListener('click', window[id]); // assign the function with the same name
	});
}

function pushState(new_route) {
	if (new_route == window.location.pathname) return;
	history.pushState({}, '', new_route);
}

function updateRoute(e, route = null) {
	const path = route ?? window.location.pathname;
	const split = path.split('/').filter(Boolean);

	switch (split[0]) {
		case '':
		case 'folder':
			const new_folder_id = split.length == 1 ? 1 : split[1];
			showFolder(null, new_folder_id);
			break;
		case 'mail':
			const new_mail = split.length == 1 ? 1 : split[1];
			showMail(null, { mail_id: new_mail }, true);
			break;
		case 'compose':
			return btn_compose();
		default:
			console.log('unknown route');
			showFolder(null, '1');
	}
}

btn_logout = auth_logout;

function btn_mails() {
	// TODO, for mobile, show evemails
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

async function doAffiliation() {
	try {
		if (whoami == null) return;
		const aff = await doJsonRequest(`https://esi.evetech.net/characters/affiliation`, 'POST', mimetype_json, JSON.stringify([`${whoami.character_id}`]));
		if (aff.length) {
			whoami.corporation_id = aff[0].corporation_id;
			whoami.corporation_name = 'Corp ' + aff[0].corporation_id;
			whoami.alliance_id = aff[0].alliance_id || 0;
			whoami.alliance_name = 'Alli ' + whoami.alliance_id;

			let res = await doRequest(`https://esi.evetech.net/corporations/${whoami.corporation_id}`);
			const corp = await res.json();
			whoami.corporation_name = corp.name;

			if (whoami.alliance_id > 0) {
				res = await doRequest(`https://esi.evetech.net/alliances/${whoami.alliance_id}`);
				const alli = await res.json();
				whoami.alliance_name = alli.name;
			}
		}
	} finally {
		setTimeout(doAffiliation, 3600000);
	}
}

let labels = {};
let current_folder = 1;
async function pm_fetchFolders() {
	try {
		const labels = await doJsonAuthRequest(`https://esi.evetech.net/characters/${whoami.character_id}/mail/labels`);
		for (const label of labels.labels) addFolder(label, false);

		const subs = await doJsonAuthRequest(`https://esi.evetech.net/characters/${whoami.character_id}/mail/lists`);
		for (const sub of subs) addFolder(sub, true);
	} catch (e) {
		console.log(e);
	} finally {
		setTimeout(pm_fetchFolders, 300000);
	}
}

async function addFolder(label, mailing_list = false) {
	let id = (mailing_list ? label.mailing_list_id : label.label_id);
	let id_str = `folder_${id}`;
	let el = document.getElementById(id_str);
	localStorage.setItem(`name-${id}`, label.name);
	if (el == null) {
		if (label.name == '[Corp]') label.name = 'Corp';
		else if (label.name == '[Alliance]') label.name = 'Alliance';

		let el_name = createEl('span', label.name, `folder-${id}-name`, 'folder-name');
		let el_count = createEl('span', '', `folder-${id}-unread`, 'unread_count');
		if (label.name == 'Sent') el_count.classList.add('d-none'); // never show unread count in sent

		el = createEl('div', null, id_str, 'folder_label', { folder_id: id }, { click: showFolder });
		el.appendChild(el_name);
		el.appendChild(el_count);

		if (id == 1) el.classList.add('folder_selected');
		document.getElementById('folders').appendChild(el);
		labels[`label_${id}`] = { esi: label, el: el };
	}
}

function updateUnreadCounts() {
	let total_unread = 0;
	let folders = document.getElementsByClassName('folder_label');
	for (const folder of folders) {
		let folder_id = folder.getAttribute('folder_id');
		if (folder_id == '2') continue;

		let unread = document.querySelectorAll(`.folder-${folder_id} .unread`).length;
		total_unread += unread;
		if (unread == 0) unread = '';
		document.getElementById(`folder-${folder_id}-unread`).innerText = unread;
	}
	document.title = (total_unread == 0 ? '' : '(' + total_unread + ') 🔴 ') + 'PodMail';
}

async function showFolder(e, folder_id = null, scrollToTop = true) {
	try {
		showSection('headers_container_full');

		let style = document.getElementById('current_folder');
		style.innerText = '';
		if (scrollToTop) document.getElementById('mail_headers').scrollTo({ top: 0 });

		let id = folder_id ?? this.getAttribute('folder_id');
		style.innerText = `.folder-${id}.showhide {display: block;}`;

		Array.from(document.getElementsByClassName('folder_selected')).forEach(el => { el.classList.remove('folder_selected') });
		document.getElementById(`folder_${id}`).classList.add('folder_selected');
		pushState(`/folder/${id}`);
		current_folder = id;
	} catch (e) {
		console.log(e);
	}
}

function btn_backToFolder(replaceState = false) {
	if (replaceState) history.replaceState({}, '', `/folder/${current_folder}`);
	showFolder(null, current_folder, false);
}

let headers_first_load = true;
let folders = {};
async function pm_fetchHeaders() {
	let mail_headers_stored = {};
	try {
		if (headers_first_load) {
			let json_str = JSON.parse(lsGet('mail_headers'));
			if (json_str) {
				mail_headers = Array.from(Object.values(json_str));
				if (mail_headers) {
					for (const mail of Object.values(mail_headers)) addMail(mail);
					setTimeout(loadNames, 1);
				}
				return setTimeout(pm_fetchHeaders, 1); // load actual headers next
			}
		}
	} catch (e) {
		console.log(e);
	} finally {
		headers_first_load = false;
	}

	mail_headers_stored = {};
	let now = Date.now();
	let total_mails = 0;
	try {
		console.log('Fetching evemail headers');

		let mail_ids = new Set(); // mail_ids to be removed after loading mail headers
		let mail_headers = document.getElementsByClassName('mail_header');
		for (const header of mail_headers) mail_ids.add(header.getAttribute('mail_id'));
		mail_ids.delete(null); // this is out header row, ignore it

		let mails, last_mail_id = -1, high_mail_id = 0;
		do {
			let last_mail_param = (last_mail_id == -1) ? '' : `?last_mail_id=${last_mail_id}`;
			mails = await doJsonAuthRequest(`https://esi.evetech.net/characters/${whoami.character_id}/mail${last_mail_param}`, 'GET', mimetype_json);

			for (const mail of mails) {
				addMail(mail);
				mail_ids.delete(`${mail.mail_id}`);
				mail_headers_stored[mail.mail_id] = mail;
			}
			if (mails.length > 0) last_mail_id = mails[mails.length - 1].mail_id;
			total_mails += mails.length;

			if (total_mails >= 500) break;
		} while (mails.length > 0);
		setTimeout(loadNames, 1);

		lsSet('mail_headers', JSON.stringify(mail_headers_stored));
		lsGet('folders', JSON.stringify(folders));

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

function addMail(mail) {
	if (!mail.labels) return;
	for (const label_id of mail.labels) {
		if (folders[label_id] == null) folders[label_id] = {};
		if (folders[label_id].mail_ids == null) folders[label_id].mail_ids = [];
		folders[label_id].mail_ids.push(mail.mail_id);
	}
	addMailHeader(mail);
}

async function addMailHeader(mail) {
	let el = document.getElementById('mail_header_' + mail.mail_id);
	if (el == null) {

		el = createEl('div', '', 'mail_header_' + mail.mail_id, ['mail_header', 'd-flex'], { mail_id: mail.mail_id }, { click: showMail });

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

const sections = ['headers_container_full', 'mail_container_full', 'compose_container_full']
function showSection(id) {
	for (const section of sections) setDisplayBlock(section, id == section);
}

function setDisplayBlock(id, visible) {
	let el = document.getElementById(id);
	if (el) {
		if (visible) el.classList.remove('d-none');
		else el.classList.add('d-none');
	} else console.error('no such element:', `#${id}`);
}

let current_mail_id = -1;
let current_mail = null;
async function showMail(e, mail, forceShow = false) {
	mail_id = this.getAttribute ? this.getAttribute('mail_id') : mail.mail_id;
	mail = localStorage.getItem(`mail-${mail_id}`);
	if (mail != null) {
		mail = JSON.parse(mail);
	} else {
		console.log('Fetching mail', mail_id);
		mail = await doJsonAuthRequest(`https://esi.evetech.net/characters/${whoami.character_id}/mail/${mail_id}`);
		if (mail.subject) localStorage.setItem(`mail-${mail_id}`, JSON.stringify(mail));
	}
	// Ensure we're showing the mail, and that we have a valid mail by checking mail.subject exists
	if ((this.getAttribute || forceShow) && mail.subject) {
		showSection('mail_container_full');

		document.getElementById('mail_body').innerHTML = '';
		document.getElementById('mail_body').scrollTo({ top: 0 });

		document.getElementById('mail_about_subject').innerHTML = mail.subject;
		document.getElementById('mail_about_timestamp').innerHTML = mail.timestamp.replace('T', ' ').replace(':00Z', '')

		// <span id="recip_id_91565688" class="compose_recipient left-img" recip_id="91565688" recip_type="character" style="order: 1117110107; --left-img: url('https://images.evetech.net/characters/91565688/portrait?size=32');">Unknown ID 91565688</span>
		let span = createEl('span', localStorage.getItem(`name-${mail.from}`) || '???', `recip_id_${mail.from}`, `load_name left-img from-${mail.from}`, { from_id: mail.from });
		applyLeftImage(span, 'character', mail.from);
		document.getElementById('mail_about_from').innerHTML = '';
		document.getElementById('mail_about_from').appendChild(span);

		document.getElementById('mail_about_recipients').innerHTML = '';
		for (let recip of mail.recipients) {
			span = createEl('span', localStorage.getItem(`name-${recip.recipient_id}`), null, `left-img recipient load_name from-${recip.recipient_id}`, { from_id: recip.recipient_id });
			applyLeftImage(span, recip.recipient_type, recip.recipient_id, recip.recipient_id, recip.recipient_id);
			document.getElementById('mail_about_recipients').appendChild(span);
		}

		document.getElementById('mail_body').innerHTML = adjustTags(mail.body.trim());

		mail.mail_id = mail_id;
		pm_updateReadStatus(mail);
		setTimeout(loadNames, 10);

		pushState(`/mail/${mail_id}`);
		current_mail_id = mail_id;
		current_mail = mail;
		setTimeout(loadNames, 1);

		checkContrast(document.getElementById('mail_body'));
	}
}

function contrastNotify() {
	alert('Some colors in this EVEmail have been adjusted to improve contrast and readability.');
	return false;
}

async function pm_updateReadStatus(mail, read = true) {
	if (mail.read == read) return; // no need to change anything

	console.log('Marking', mail.mail_id, 'as read:', read);
	let url = `https://esi.evetech.net/characters/${whoami.character_id}/mail/${mail.mail_id}`
	let res = await doAuthRequest(url, 'PUT', mimetype_json, JSON.stringify({ labels: mail.labels, read: true }));

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
		.replace(/ color="#ff/gi, ' color="#')
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
	try {
		let els = document.getElementsByClassName('load_name');
		let fetch_names = [];
		for (const el of els) {
			let from_id = parseInt(el.getAttribute('from_id'));

			let saved_name = localStorage.getItem(`name-${from_id}`);
			if (saved_name && saved_name.substring(0, 10) != 'Unknown ID') {
				el.innerHTML = localStorage.getItem(`name-${from_id}`);
				el.classList.remove('load_name');
			} else if (fetch_names.includes(from_id) == false) fetch_names.push(from_id);
		}
		await fetchNames(fetch_names);
	} finally {
		setTimeout(loadNames, 1000);
	}
}

async function fetchNames(fetch_names) {
	try {
		if (fetch_names.length > 0) {
			console.log('Fetching', fetch_names.length, 'names', fetch_names);
			let names = await doJsonRequest('https://esi.evetech.net/universe/names', 'POST', mimetype_json, JSON.stringify(fetch_names))
			for (const name_record of names) applyNameToId(name_record);
		}
	} catch (e) {
		console.log(e);
		await sleep(1000);
		if (fetch_names.length > 1) {
			const middle = Math.ceil(fetch_names.length / 2);
			await fetchNames(fetch_names.slice(0, middle));
			await fetchNames(fetch_names.slice(middle));
		} else {
			console.log('error fetching name for', fetch_names[0]);

			// well ok... let's try loading the character's public data
			let name;
			try {
				name = await getPublicCharacterName(fetch_names[0]);
				if (! typeof name == 'string') name = 'Unknown ID ' + fetch_names[0];
			} catch (e) {
				name = 'Unknown ID ' + fetch_names[0];
			}
			applyNameToId({
				"category": "character", "id": fetch_names[0], "name": name
			});
		}
	}
}

async function getPublicCharacterName(character_id) {
	const char = await doJsonRequest(`https://esi.evetech.net/characters/${character_id}`);
	return char.name;
}

async function fetchIDFromName(the_name) {
	try {
		return await doJsonRequest('https://esi.evetech.net/universe/ids', 'POST', mimetype_json, JSON.stringify([the_name]));
	} catch (e) {
		return {};
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

function btn_reply(e) {
	btn_replyAll(e, false);
}

function btn_replyAll(e, all_recips = true) {
	let recipients = [{ type: 'character', info: { id: current_mail.from, name: localStorage.getItem(`name-${current_mail.from}`) || 'Unknown Name' } }];

	if (all_recips) {
		for (const recip of current_mail.recipients) {
			if (recip.recipient_id != whoami.character_id) { // don't include ourselves
				recipients.push({ type: recip.recipient_type, info: { id: recip.recipient_id, name: localStorage.getItem(`name-${recip.recipient_id}`) || 'Unknown Name' } });
			}
		}
	}
	console.log(recipients);

	btn_compose('Re: ' + current_mail.subject, "\n\n=====\n\n" + current_mail.body, recipients);
}

function btn_compose(subject = '', body = '', recipients = []) {
	document.getElementById('btn_addAlli').disabled = (whoami.alliance_id == 0);
	document.getElementById('btn_group_ml').innerHTML = '';
	for (const [id, label] of Object.entries(labels)) {
		if (label.esi.mailing_list_id > 0) {
			let btn = createEl('button', label.esi.name, null, 'btn btn-info', { type: 'button', ml_id: label.esi.mailing_list_id }, { click: btn_addML });
			document.getElementById('btn_group_ml').appendChild(btn);
		}
	}

	if (subject.length > 0) document.getElementsByName('compose_subject')[0].value = subject;
	if (body.length > 0) document.getElementById('compose_body_textarea').innerHTML = adjustTags(body);

	if (recipients.length > 0) {
		document.getElementById('compose_recipients_calculated').innerHTML = '';
		for (const recip of recipients) addComposeRecipient(recip.type, recip.info);
	}

	pushState('/compose');
	showSection('compose_container_full');
}

async function updateComposeRecipients(e) {
	let composeInput = document.getElementsByName('compose_recipients')[0];
	let typing = document.activeElement === composeInput;
	let val = composeInput.value;
	let unmatched_names = [];

	if (typing == false) {
		let split = val.split(',').filter(Boolean);
		for (let value of split) {
			value = value.trim();
			let matched = false;
			let result = await fetchIDFromName(value);
			for (const [type, matches] of Object.entries(result)) {
				if (type != 'characters') continue;
				for (const match of matches)
					matched |= addComposeRecipient('character', match);
			}
			if (!matched) unmatched_names.push(value);
		}
		if (unmatched_names.length > 0) alert('The following character names have been rejected because of no exact matches:<br/><br/>' + unmatched_names.join('<br/>'));
		document.getElementsByName('compose_recipients')[0].value = '';
	}
}


function btn_addCorp() {
	addComposeRecipient('corporation', { id: whoami.corporation_id, name: whoami.corporation_name });
}

function btn_addAlli() {
	addComposeRecipient('alliance', { id: whoami.alliance_id, name: whoami.alliance_name });
}

function btn_addML() {
	addComposeRecipient('mailing_list', { id: this.getAttribute('ml_id'), name: this.innerText });
}

function addComposeRecipient(type, info) {
	if (document.getElementById(`#compose_recipients_calculated .recip_id_${info.id}`)) return true;
	let span = createEl('span', info.name, null, 'recip_id_${info.id} compose_recipient left-img', { recip_id: info.id, recip_type: type });
	applyLeftImage(span, type, info.id, whoami.corporation_id, whoami.alliance_id);
	span.addEventListener('click', removeSelf);

	if (span) {
		document.getElementById('compose_recipients_calculated').appendChild(span);
		return true;
	}
	return false;
}

function applyLeftImage(span, type, character_id, corporation_id, alliance_id) {
	span.style.order = getStrOrder(span.innerText);
	if (type == 'character') span.style.setProperty('--left-img', `url('https://images.evetech.net/characters/${character_id}/portrait?size=32')`);
	else if (type == 'corporation') span.style.setProperty('--left-img', `url('https://images.evetech.net/corporations/${corporation_id}/logo?size=32')`);
	else if (type == 'alliance') span.style.setProperty('--left-img', `url('https://images.evetech.net/alliances/${alliance_id}/logo?size=32')`);
	else if (type == 'mailing_list') span.style.setProperty('--left-img', `url('/img/mailing_list.png')`);
	else if (type == 'mailing_list') span.style.setProperty('--left-img', `url('/img/qyuestion.png')`);
}

function removeSelf() {
	this.remove();
}

function btn_reset(e) {
	document.getElementsByName('compose_subject')[0].value = '';
	document.getElementById('compose_body_textarea').innerHTML = '';
	document.getElementById('compose_recipients_calculated').innerHTML = '';
}

let sending_evemail = false;
async function btn_send(e) {
	if (sending_evemail) return; // stops double clickers

	try {
		sending_evemail = true;

		// Validation first
		let recips = document.getElementsByClassName('compose_recipient');
		if (recips.length == 0) return alert('You have not added any recipients.');

		let subject = document.getElementsByName('compose_subject')[0].value;
		if (subject.length == 0) return alert('You have not added a subject.');

		let body = document.getElementById('compose_body_textarea').innerHTML;
		if (body.length == 0) return alert('You have not added any content.');

		let recipients = [];
		for (const r of recips) {
			recipients.push({ recipient_type: r.getAttribute('recip_type'), recipient_id: parseInt(r.getAttribute('recip_id')) });
		}

		// OK validation is done
		let msg = {
			approved_cost: 10001,
			recipients: recipients,
			body,
			subject,
		};

		console.log('Sending eve mail')
		console.log(msg);

		let res = await doAuthRequest(`https://esi.evetech.net/characters/${whoami.character_id}/mail`, 'POST', mimetype_json, JSON.stringify(msg));
		if (typeof res == 'number' && res > 0) {
			// success!
			document.getElementById('compose_recipients_calculated').innerHTML = '';
			document.getElementsByName('compose_subject')[0].value = '';
			document.getElementById('compose_body_textarea').value = '';
			return btn_backToFolder();
		}
		console.log(res);
		alert('There was an error sending your evemail' + (res.error ? ':<br/><br/>' + res.error : ''));
	} finally {
		sending_evemail = false;
	}
}

async function btn_deleteMail(e) {
	if (! await confirm('Are you sure you wwant to PERMANENTLY delete this evemail?')) return;

	let url = `https://esi.evetech.net/characters/${whoami.character_id}/mail/${current_mail_id}`;
	let res = await doAuthRequest(url, 'DELETE', mimetype_json);
	if (res.status == 204) {
		let mail_header = document.getElementById(`mail_header_${current_mail_id}`)
		if (mail_header) mail_header.remove(); // for that rare instance it gets removed elsewhere while the user deletes

		localStorage.removeItem(`mail-${current_mail_id}`);
		btn_backToFolder();
	}
	else alert('Error Code: ' + res.status);
}


window.confirm = async function (message) {
	return new Promise(resolve => {
		const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
		document.querySelector('#confirmModal .modal-body').textContent = message;

		const okBtn = document.getElementById('confirmOk');
		const cancelBtn = document.getElementById('confirmCancel');

		const cleanup = () => {
			okBtn.onclick = null;
			cancelBtn.onclick = null;
		};

		okBtn.onclick = () => { cleanup(); document.activeElement.blur(); modal.hide(); resolve(true); };
		cancelBtn.onclick = () => { cleanup(); document.activeElement.blur(); modal.hide(); resolve(false); };

		modal.show();
	});
};

window.alert = async function (message) {
	return new Promise(resolve => {
		const modalEl = document.getElementById('alertModal');
		const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
		const messageEl = document.getElementById('alertModalMessage');
		const okButton = document.getElementById('alertModalOk');

		messageEl.innerHTML = message;

		const newButton = okButton.cloneNode(true);
		okButton.parentNode.replaceChild(newButton, okButton);

		newButton.addEventListener('click', () => {
			document.activeElement.blur();
			modal.hide();
			resolve();
		});

		modal.show();
	});
};

function getStrOrder(str) {
	return '1' + str.toLowerCase().slice(0, 3).split('').map(c => c.charCodeAt(0).toString().padStart(3, '0')).join('');
}

function getLuminance(r, g, b) {
	const a = [r, g, b].map(v => {
		v /= 255;
		return v <= 0.03928
			? v / 12.92
			: Math.pow((v + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function getContrast(rgb1, rgb2) {
	const L1 = getLuminance(...rgb1);
	const L2 = getLuminance(...rgb2);
	return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

function parseRGB(str) {
	const match = str.match(/\d+/g);
	return match ? match.map(Number) : [0, 0, 0];
}

const contrast_adjusted = document.getElementById('mail_body_adjusted');
function checkContrast(el) {
	contrast_adjusted.dataset.contrast = false;
	adjustTextContrast(el);
}

function adjustTextContrast(el) {
	const style = getComputedStyle(el);
	const fg = parseRGB(style.color);
	const bg = parseRGB(style.backgroundColor === 'rgba(0, 0, 0, 0)' ? getComputedStyle(el.parentElement).backgroundColor : style.backgroundColor);

	let contrast = getContrast(fg, bg);

	// Lighten text until contrast is at least 4.5:1
	let [r, g, b] = fg;
	while (contrast < 4.5 && (r < 255 || g < 255 || b < 255)) {
		r = Math.min(255, r + 10);
		g = Math.min(255, g + 10);
		b = Math.min(255, b + 10);
		contrast = getContrast([r, g, b], bg);
		contrast_adjusted.dataset.contrast = true;
	}

	el.style.color = `rgb(${r}, ${g}, ${b})`;
	Array.from(el.children).forEach(adjustTextContrast);
}
