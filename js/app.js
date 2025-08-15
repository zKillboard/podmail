const githubhash = "936f6b9";

document.addEventListener('DOMContentLoaded', doBtnBinds);
document.addEventListener('DOMContentLoaded', main);

function doBtnBinds() {
	// bind buttons with class btn-bind to a function equivalent to the button's id
	Array.from(document.getElementsByClassName('btn-bind')).forEach((el) => {
		const id = el.id;
		if (id == null || id.trim().length == 0) return console.error('this btn-bind does not have an id', el);
		if (!window[id] || typeof window[id] != 'function') return console.error('button', id, 'does not have a matching function');
		el.addEventListener('click', window[id]); // assign the function with the same name
	});
}

async function main() {
	// This is for localhost testing
	if (githubhash == '') document.getElementById('podmailLink').setAttribute('href', '/?' + Date.now());

	esi.setOption('esiInFlightHandler', handleInflight);
	esi.setOption('esiIssueHandler', handleEsiIssue);

	// esi.whoami is defined and handled in SimpleESI.js
	if (esi.whoami == null) {
		loadReadme('readme');
		return document.getElementById('about').classList.remove('d-none');
	}
	document.getElementById('podmail').classList.remove('d-none');

	document.getElementById('charname').innerHTML = esi.whoami.name;
	document.getElementById('charimg').setAttribute('src', `https://images.evetech.net/characters/${esi.whoami.character_id}/portrait?size=32`);
	document.getElementById('charimg').setAttribute('alt', esi.whoami.name);

	setTimeout(updateTime, 0);
	setTimeout(updateTqStatus, 0);

	addFolder({ label_id: 0, 'name': 'All' });
	initFolders();
	initHeaders();

	window.addEventListener('popstate', updateRoute);

	let referrer = document.referrer ? new URL(document.referrer).pathname + new URL(document.referrer).search + new URL(document.referrer).hash : '';
	if (referrer != '/') updateRoute(null, referrer);

	document.getElementsByName('compose_recipients')[0].addEventListener('blur', updateComposeRecipients);
	document.getElementsByName('compose_recipients')[0].addEventListener('input', updateComposeRecipients);
	document.getElementById('mail_headers_checkbox').addEventListener('change', mail_headers_checkbox_changed);

	startNetworkCalls();
}

async function startNetworkCalls(level = 0) {
	try {
		switch (level) {
			case 0:
				await fetchFolders();
				break;
			case 1:
				await fetchHeaders();
				break;
			case 2:
				await fetchUnfetchedMails();
				break;
			case 3:
				await doAffiliation();
				break;
			case 4:
				await versionCheck();
				break;
			default:
				if (navigator.serviceWorker) await navigator.serviceWorker.register('/sw.js?v=936f6b9');
				return;
		}
		setTimeout(startNetworkCalls.bind(null, ++level, 1));
	} catch (e) {
		console.log(e);
		setTimeout(startNetworkCalls.bind(null, level), 15000);
	}
}

async function versionCheck() {
	try {
		if (window.location.hostname == 'localhost') return;

		let docgithubhash = document.getElementById('html').getAttribute('githubhash');
		let podmail_version = (await (await (await fetch('/podmail.version?' + Date.now()))).text()).trim();
		if (podmail_version.length > 40) return; // that's not an expected hash, are we offline?

		// Check the hash, if they don't match, we need to cache-bust
		if (githubhash != docgithubhash || githubhash != podmail_version) {
			if (await confirm('A new version of PodMail has been detected, would you like to refresh to get the lastest version?')) {
				return window.location = `/?githubhash=${podmail_version}`;
			}
		}
	} finally {
		setTimeout(versionCheck, 3600000); // check again in an hour
	}
}

function pushState(new_route) {
	if (new_route == window.location.pathname) return;
	history.pushState({}, '', new_route);
}

function updateRoute(e, route = null) {
	const path = route ?? window.location.pathname;
	const split = path.split('/').filter(Boolean);

	//let el = 
	//const getScrollPoint = el => ({ x: el.scrollLeft, y: el.scrollTop });

	switch (split[0]) {
		case '':
		case '/':
		case 'folder':
			const new_folder_id = split.length == 1 ? 0 : split[1];
			showFolder(null, new_folder_id, false);
			break;
		case 'mail':
			const new_mail = split.length == 1 ? 1 : split[1];
			showMail(null, { mail_id: new_mail }, true);
			break;
		case 'compose':
			return btn_compose();
		default:
			console.log('unknown route');
			showFolder(null, '0');
	}
}

async function btn_login() {
	return await esi.authBegin();
}

async function btn_logout() {
	if (await confirm('Are you sure you want to logout?')) setTimeout(btn_logout_datacheck, 100);
}

async function btn_logout_datacheck() {
	let not_destructive = await confirm('Do you keep already fetched data for faster processing next time you login?');
	return await esi.authLogout(!not_destructive);
}

async function loadReadme(id) {
	let res = await fetch('/README.md?v=936f6b9');
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
	let delay = 300000;
	try {
		if (esi.whoami == null) return;

		console.log('Updating affiliation');
		const aff = await esi.doJsonRequest(`https://esi.evetech.net/characters/affiliation`, 'POST', esi.mimetype_json, JSON.stringify([`${esi.whoami.character_id}`]));
		if (aff.length) {
			esi.whoami.corporation_id = aff[0].corporation_id;
			esi.whoami.corporation_name = 'Corp ' + aff[0].corporation_id;
			esi.whoami.alliance_id = aff[0].alliance_id || 0;
			esi.whoami.alliance_name = 'Alli ' + esi.whoami.alliance_id;

			let res = await esi.doRequest(`https://esi.evetech.net/corporations/${esi.whoami.corporation_id}`);
			const corp = await res.json();
			esi.whoami.corporation_name = corp.name;

			if (esi.whoami.alliance_id > 0) {
				res = await esi.doRequest(`https://esi.evetech.net/alliances/${esi.whoami.alliance_id}`);
				const alli = await res.json();
				esi.whoami.alliance_name = alli.name;
			}
			delay = 36000000;
		}
	} catch (e) {
		console.log(e);
	} finally {
		setTimeout(doAffiliation, delay);
	}
}

function initFolders() {
	console.log('Loading stored folders');
	let lastLabels = esi.lsGet('labels');
	for (const [id, label] of (Object.entries(lastLabels || {}))) {
		addFolder(label.esi, label.esi.mailing_list_id > 0);
	}
}

let labels = {};
let current_folder = 1;
async function fetchFolders() {
	try {
		console.log('Fetching folders...');

		const cur_labels = await esi.doJsonAuthRequest(`https://esi.evetech.net/characters/${esi.whoami.character_id}/mail/labels`);
		for (const label of cur_labels.labels) addFolder(label, false);

		const subs = await esi.doJsonAuthRequest(`https://esi.evetech.net/characters/${esi.whoami.character_id}/mail/lists`);
		for (const sub of subs) addFolder(sub, true);

		esi.lsSet('labels', labels);
	} catch (e) {
		console.log(e);
		showToast('Error fetching your labels and mailing list subscriptions... :(')
	} finally {
		setTimeout(fetchFolders, 300000);
	}
}

function addFolder(label, mailing_list = false, save = true) {
	let id = (mailing_list ? label.mailing_list_id : label.label_id);
	let id_str = `folder_${id}`;
	let el = document.getElementById(id_str);
	if (el == null) {
		if (label.name == '[Corp]') label.name = 'Corp';
		else if (label.name == '[Alliance]') label.name = 'Alliance';
		if (save) esi.lsSet(`name-${id}`, label.name);

		let el_name = createEl('span', label.name, `folder-${id}-name`, 'folder-name');
		let el_count = createEl('span', '', `folder-${id}-unread`, 'unread_count');
		if (label.name == 'Sent') el_count.classList.add('d-none'); // never show unread count in sent

		el = createEl('div', null, id_str, 'folder_label', { folder_id: id }, { click: showFolder });
		if (mailing_list) el.classList.add('mailing_list');
		el.appendChild(el_name);
		el.appendChild(el_count);

		if (id == 1) el.classList.add('folder_selected');
		document.getElementById('folders').appendChild(el);
		if (save) labels[`label_${id}`] = { esi: label, el: el };
	}
}

function updateUnreadCounts() {
	let total_unread = 0;
	let folders = document.getElementsByClassName('folder_label');
	for (const folder of folders) {
		let folder_id = folder.getAttribute('folder_id');
		if (folder_id == '2') continue;

		let unread = document.querySelectorAll(`.folder-${folder_id} .unread`).length;
		if (folder_id != 0) total_unread += unread;
		if (unread == 0) unread = '';
		document.getElementById(`folder-${folder_id}-unread`).innerText = unread;
	}
	document.title = "";
	document.title = (total_unread == 0 ? '' : '(' + total_unread + ') 🔴 ') + 'PodMail';
}

async function showFolder(e, folder_id = null, scrollToTop = true) {
	try {
		showSection('headers_container_full');

		let style = document.getElementById('current_folder');
		style.innerText = '';
		if (scrollToTop) document.getElementById('mail_headers').scrollTo({ top: 0 });

		let id = folder_id ?? this.getAttribute('folder_id');
		let folder_name = labels[`label_${id}`]?.esi?.name ?? 'ML ' + folder_id;

		style.innerText = `.folder-${id}.showhide {display: block;}`;
		//console.log('Switching to folder:', folder_name);

		Array.from(document.getElementsByClassName('folder_selected')).forEach(el => { el.classList.remove('folder_selected') });
		pushState(`/folder/${id}`);
		current_folder = id;

		document.getElementById('current_folder_name').innerText = folder_name;
		document.getElementById(`folder_${id}`).classList.add('folder_selected');
	} catch (e) {
		console.log(e);
	} finally {
		checkMulti();
		btn_viewRight();
		updateUnreadCounts();
	}
}

function btn_backToFolder(replaceState = false) {
	if (replaceState) history.replaceState({}, '', `/folder/${current_folder}`);
	showFolder(null, current_folder, false);
}

function initHeaders() {
	console.log('Loading stored mail haeaders');
	addAllMailsFromHeader(esi.lsGet('mail_headers') || {});
	addAllMailsFromHeader(esi.lsGet('mail_headers_partial') || {});
}

let all_highest_mail_id = -1;
let headers_first_load = true;
let headers_iteration_count = 0;
async function fetchHeaders() {
	let mail_headers_stored = {};
	let now = Date.now();
	let total_mails = 0;
	let full_iteration = (headers_iteration_count % 10 == 0);
	headers_iteration_count++;
	try {
		console.log('Fetching evemail headers:', (full_iteration ? 'up to 10 pages' : '1 page'));

		let mail_ids = new Set(); // mail_ids to be removed after loading mail headers
		let mail_headers = document.getElementsByClassName('mail_header');
		for (const header of mail_headers) mail_ids.add(header.getAttribute('mail_id'));
		mail_ids.delete(null); // this is the header row, ignore it so it doesn't get removed

		let mails, last_mail_id = Number.MAX_SAFE_INTEGER, highest_mail_id = -1;
		do {
			let last_mail_param = (last_mail_id == Number.MAX_SAFE_INTEGER) ? '' : `?last_mail_id=${last_mail_id}`;
			mails = await esi.doJsonAuthRequest(`https://esi.evetech.net/characters/${esi.whoami.character_id}/mail${last_mail_param}`, 'GET', esi.mimetype_json);

			let ids = addAllMailsFromHeader(mails, mail_headers_stored);
			for (const i of ids) {
				highest_mail_id = Math.max(highest_mail_id, i);
				last_mail_id = Math.min(last_mail_id, i);
				mail_ids.delete(i);
			}

			if (mails.length > 0) {
				//last_mail_id = mails[mails.length - 1].mail_id;
			}
			total_mails += mails.length;

			updateUnreadCounts();
			if (total_mails >= 500) break;
		} while (full_iteration && mails.length >= 50);
		setTimeout(loadNames, 1);

		if (full_iteration) {
			esi.lsSet('mail_headers', mail_headers_stored);

			if (mail_ids.size) {
				// Cleanup removed mails
				for (const mail_id of Array.from(mail_ids)) {
					const el = document.querySelector(`[mail_id="${mail_id}"]`);
					if (el) el.remove();
				}
				console.log('Removed', mail_ids.size, 'mails');
			}
		} else {
			esi.lsSet('mail_headers_partial', mail_headers_stored);
		}
		all_highest_mail_id = Math.max(highest_mail_id, all_highest_mail_id);
	} catch (e) {
		console.log(e);
	} finally {
		console.log('Loaded', total_mails, 'mail headers in', Date.now() - now, 'ms');
		setTimeout(updateUnreadCounts, 1);
		setTimeout(fetchHeaders, 61000);
	}
}

function addAllMailsFromHeader(headers, mail_headers_stored = {}) {
	let mail_ids = new Set();

	if (headers == null) return mail_ids;
	if (typeof headers == 'object') {
		headers = Array.from(Object.values(headers))
	}

	for (const mail of headers) {
		addMail(mail);
		mail_ids.add(`${mail.mail_id}`);
		mail_headers_stored[mail.mail_id] = mail;
		if (all_highest_mail_id != -1 && mail.mail_id > all_highest_mail_id && mail.is_read != true) {
			showNotification('New EveMail!', mail.subject, mail);
		}
	}

	return mail_ids;
}

async function showNotification(title, body, mail) {
	if (Notification.permission === 'default') {
		await Notification.requestPermission();
	}

	if (Notification.permission === 'granted') {
		const n = new Notification(title, {
			body: body,
			icon: '/img/podmail.png' // optional
		});
		n.onclick = () => {
			window.focus();
			if (mail) {
				//console.log('Notification clicked, showing mail');
				showMail(null, mail, true);
			}
		}
	} else {
		showToast(`${title}<br/>${body}`);
	}
}

async function fetchUnfetchedMails() {
	let delay = 250;
	try {
		if (all_highest_mail_id == -1) return; // headers aren't finished loading yet after page load

		let span = document.querySelector('.unfetched');
		if (span == null) return; // nothing to fetch!

		let mail_id = span.getAttribute('mail_id');
		let mail = esi.lsGet(`mail-${mail_id}`);
		if (mail != null && mail.subject) {
			delay = 1;
		} else {
			await getMail(mail_id, false);
		}
		span.classList.remove('unfetched');
	} finally {
		setTimeout(fetchUnfetchedMails, delay);
	}
}

function addMail(mail) {
	if (!mail.labels) return;

	addMailHeader(mail);
}

async function addMailHeader(mail) {
	let body = document.getElementsByTagName('body')[0];
	let el = document.getElementById('mail_header_' + mail.mail_id);
	if (el == null) {

		el = createEl('div', '', 'mail_header_' + mail.mail_id, ['mail_header', 'd-flex'], { mail_id: mail.mail_id }, { click: showMail });

		let classes = ['showhide', 'ordered', 'folder-0'];
		for (let id of mail.labels) classes.push(`folder-${id}`);
		for (let recip of mail.recipients) {
			if (recip.recipient_type == 'mailing_list') {
				classes.push(`folder-${recip.recipient_id}`);
				addFolder({ mailing_list_id: recip.recipient_id, 'name': `ML ${recip.recipient_id}` }, true, false);
			} else {
				// preload the names with this bass ackwards method that continues to use the DOM as a db
				if (esi.lsGet(`name-${recip.recipient_id}`) == null) {
					let span = document.getElementById(`preload-${recip.recipient_id}`);
					if (span == null) {
						span = createEl('span', '', `preload-${recip.recipient_id}`, 'd-none preload load_name', { from_id: recip.recipient_id });
						body.appendChild(span);
					}
				}
			}
		}
		elp = createEl('div', null, null, classes);
		elp.style.order = mail.mail_id;
		elp.appendChild(el);

		//  createEl(tag, innerHTML, id = null, classes = [], attributes = {}, events = {}) {
		let chk = createEl('input', '', `mail-checkbox-${mail.mail_id}`, 'mail_checkbox form_check_input unfetched', { type: 'checkbox', mail_id: mail.mail_id, 'aria-label': 'unchecked' }, { click: mailCheckboxClick, change: mailCheckboxClick });
		let chkspan = createEl('span', '', `span-chk-${mail.mail_id}`, 'span_chk form-check', { mail_id: mail.mail_id }, { click: mailCheckboxClick });
		chkspan.appendChild(chk);
		el.appendChild(chkspan);

		el.appendChild(createEl('span', esi.lsGet(`name-${mail.from}`), null, `from load_name from-${mail.from}`, { from_id: mail.from }));
		el.appendChild(createEl('span', mail.subject, null, 'subject flex-fill'));
		el.appendChild(createEl('span', mail.timestamp.replace('T', ' ').replace(':00Z', ''), null, 'timestamp text-end'));

		document.getElementById('mail_headers').appendChild(elp);

	}
	if (mail.is_read == true) el.classList.remove('unread');
	else el.classList.add('unread');
}

function mailCheckboxClick(e, tthis = null, forceSelectionTo = null) {
	if (e.stopImmediatePropagation) e.stopImmediatePropagation();
	if (e.stopPropogation) e.stopPropogation();
	if (e.type != 'change') return false;

	tthis = tthis ?? this;

	let mail_id = parseInt(tthis.getAttribute('mail_id'));
	let header = document.getElementById(`mail_header_${mail_id}`);

	if (forceSelectionTo !== null) tthis.checked = forceSelectionTo;

	if (header) {
		if (tthis.checked) header.classList.add('selected');
		else header.classList.remove('selected');
		tthis.setAttribute('aria-label', (tthis.checked ? 'checked' : 'unchecked'));
	}

	if (forceSelectionTo === null) checkMulti();
	return false;
}

function checkMulti() {
	let displayed = document.querySelectorAll(`.folder-${current_folder}.showhide input[type='checkbox']`).length;
	let checked = document.querySelectorAll(`.folder-${current_folder}.showhide input[type='checkbox']:checked`).length;

	document.getElementById('mail_headers_checkbox').checked = (checked == displayed && displayed > 0);

	document.getElementById('btn_multi_markReadStatus').disabled = (checked == 0);
	document.getElementById('btn_multi_deleteMail').disabled = (checked == 0);
}

function mail_headers_checkbox_changed(e) {
	if (e.stopImmediatePropagation) e.stopImmediatePropagation();
	if (e.stopPropogation) e.stopPropogation();
	if (e.type != 'change') return false;
	//console.log('triggered mail_headers_checkbox_changed');

	Array.from(document.querySelectorAll(`.folder-${current_folder}.showhide input[type='checkbox']`)).forEach((el) =>
		mailCheckboxClick({ type: 'change' }, el, this.checked));
	checkMulti();
}

async function btn_multi_markReadStatus(e) {
	let checked = Array.from(document.querySelectorAll(`.folder-${current_folder}.showhide input[type='checkbox']:checked`));
	for (const el of checked) {
		await pm_updateReadStatus(await getMail(el.getAttribute('mail_id')), this.dataset.read != "true");
	}
	checkMulti();
	updateUnreadCounts();
}


async function btn_multi_deleteMail(e) {
	let checked = Array.from(document.querySelectorAll(`.folder-${current_folder}.showhide input[type='checkbox']:checked`));

	if (! await confirm('Are you sure you wwant to PERMANENTLY delete these evemails?')) return;

	let mail_ids = [];
	for (const el of checked) mail_ids.push(el.getAttribute('mail_id'));
	mail_ids = mail_ids.sort();
	while (mail_ids.length) await btn_deleteMail(null, mail_ids.pop(), true);

	checkMulti();
	updateUnreadCounts();
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
	mail = await getMail(mail_id);

	// Ensure we're showing the mail, and that we have a valid mail by checking mail.subject exists
	if ((this.getAttribute || forceShow) && mail.subject) {
		showSection('mail_container_full');

		document.getElementById('mail_body').innerHTML = '';

		document.getElementById('mail_about_subject').innerHTML = mail.subject;
		document.getElementById('mail_about_timestamp').innerHTML = mail.timestamp.replace('T', ' ').replace(':00Z', '')

		let span = createEl('span', esi.lsGet(`name-${mail.from}`) || '???', `recip_id_${mail.from}`, `load_name left-img from-${mail.from}`, { from_id: mail.from });
		applyLeftImage(span, 'character', mail.from);
		document.getElementById('mail_about_from').innerHTML = '';
		document.getElementById('mail_about_from').appendChild(span);

		document.getElementById('mail_about_recipients').innerHTML = '';

		for (let recip of mail.recipients) {
			span = createEl('span', esi.lsGet(`name-${recip.recipient_id}`) || '', null, `left-img recipient from-${recip.recipient_id}`, { from_id: recip.recipient_id });
			if (recip.recipient_type == 'mailing_list' && esi.lsGet(`name-${recip.recipient_id}`) == null) span.innerText = 'Unknown Mailing List';
			else if (recip.recipient_type != 'mailing_list') span.classList.add('load_name');

			applyLeftImage(span, recip.recipient_type, recip.recipient_id, recip.recipient_id, recip.recipient_id);
			document.getElementById('mail_about_recipients').appendChild(span);
		}

		document.getElementById('mail_body').innerHTML = adjustLinks(adjustTags(mail.body.trim()));
		document.querySelectorAll('#mail_body a[href^="http"]:not([target])')
			.forEach(a => { a.target = '_blank'; a.rel ||= 'noopener'; });

		mail.mail_id = mail_id;
		pm_updateReadStatus(mail);
		setTimeout(loadNames, 10);

		pushState(`/mail/${mail_id}`);
		current_mail_id = mail_id;
		current_mail = mail;
		setTimeout(loadNames, 1);
		document.getElementById('btn_markReadStatus').dataset.read = true;

		checkContrast(document.getElementById('mail_body'));
		btn_viewRight();
		requestAnimationFrame(() => { document.getElementById('mail_all').scrollTo({ top: 0 }); });
	}
}

async function getMail(mail_id, user_requested = true) {
	mail = esi.lsGet(`mail-${mail_id}`);
	if (mail != null && typeof mail == 'object') {
		mail.mail_id = mail_id;
		return mail;
	}

	try {
		console.log('Fetching mail', mail_id);
		mail = await esi.doJsonAuthRequest(`https://esi.evetech.net/characters/${esi.whoami.character_id}/mail/${mail_id}`);
	} catch (e) {
		if (user_requested) showToast('error fetching that evemail... :(');
	}
	mail.mail_id = mail_id;
	if (mail.subject) esi.lsSet(`mail-${mail_id}`, mail);
	return mail;
}

function contrastNotify() {
	alert('Some colors in this EVEmail have been adjusted to improve contrast and readability.');
	return false;
}

async function pm_updateReadStatus(mail, read = true) {
	if (mail.read == read) return; // no need to change anything

	if (mail.mail_id == null) return console.error('mail has no mail_id', mail);

	console.log('Marking', mail.mail_id, 'as read:', read);
	let url = `https://esi.evetech.net/characters/${esi.whoami.character_id}/mail/${mail.mail_id}`
	let res = await esi.doAuthRequest(url, 'PUT', esi.mimetype_json, JSON.stringify({ labels: mail.labels, read: read }));

	if (res.status == 204) { // Success
		let el = document.querySelector(`[mail_id="${mail.mail_id}"]`);
		if (read) el.classList.remove('unread');
		else el.classList.add('unread');
		updateUnreadCounts();

		mail.read = read;
		document.getElementById('btn_markReadStatus').dataset.read = read;
		esi.lsSet(`mail-${mail.mail_id}`, mail);
	}
}

function adjustTags(html) {
	return html
		.replace(/ color="#ff/gi, ' color="#')
		.replace(/\n/g, '<br/>')
}

const STATION_TYPE_IDS = [
	14, 54, 56, 57, 58, 59, 1529, 1530, 1531, 1926, 1927, 1928, 1929, 1930, 1931,
	1932, 2071, 2496, 2497, 2498, 2499, 2500, 2501, 2502, 3864, 3865, 3866, 3867,
	3868, 3869, 3870, 3871, 3872, 4023, 4024, 9856, 9857, 9867, 9868, 9873, 10795,
	12242, 12294, 12295, 19757, 21642, 21644, 21645, 21646, 22296, 22297, 22298,
	29323, 29387, 29388, 29389, 29390, 34325, 34326, 52678, 59956, 71361, 74397,
];

const CHARACTER_TYPE_IDS = [
	1373, 1374, 1375, 1376, 1377, 1378, 1379, 1380, 1381, 1382, 1383, 1384, 1385,
	1386, 34574
];

const REPLACE_WITH = ' onClick=\'showToast("An in game link without proper mapping within PodMail. Sorry..."); return false;\' href="showInfo:';

// https://github.com/joaomlneto/jitaspace/blob/d3d0969245fae4f6263931f8237803b8af6da3ca/packages/tiptap-eve/Extensions/EveLink.ts#L12C1-L15C3
// need to add showinfo for ships, stations, etc, basically any showinfo
function adjustLinks(html) {
	html = html
		.replace(/href="killReport:/g, 'target=\'_blank\' href="https://zkillboard.com/kill/')
		.replace(/href="showinfo:4\/\//g, 'href="https://zkillboard.com/constellation/')
		.replace(/href="showinfo:3\/\//g, 'href="https://zkillboard.com/region/')
		.replace(/href="showinfo:5\/\//g, 'href="https://zkillboard.com/system/')
		.replace(/href="showinfo:47466\/\//g, 'href="https://zkillboard.com/item/')
		.replace(/href="showinfo:2\/\//g, 'href="https://evewho.com/corporation/')
		.replace(/href="showinfo:16159\/\//g, 'href="https://evewho.com/alliance/')
		.replace(/href="showinfo:30\/\//g, 'href="https://evewho.com/faction/')

	for (const id of STATION_TYPE_IDS) {
		const regex = new RegExp(`href="showinfo:${id}\\/\\/`, 'g');
		html = html.replace(regex, 'href="https://zkillboard.com/location/');
	}

	for (const id of CHARACTER_TYPE_IDS) {
		const regex = new RegExp(`href="showinfo:${id}\\/\\/`, 'g');
		html = html.replace(regex, 'href="https://evewho.com/character/');
	}

	html = html
		.replace(/href="opportunity:/g, REPLACE_WITH)
		.replace(/href="localsvc:/g, REPLACE_WITH)
		.replace(/href="helpPointer:/g, REPLACE_WITH)
		.replace(/href="showinfo:/g, REPLACE_WITH)

	return html;
}

async function loadNames() {
	try {
		let els = document.getElementsByClassName('load_name');
		let fetch_names = [];
		for (const el of els) {
			let from_id = parseInt(el.getAttribute('from_id'));

			let saved_name = esi.lsGet(`name-${from_id}`);
			if (saved_name && saved_name.substring(0, 10) != 'Unknown ID') {
				el.innerHTML = esi.lsGet(`name-${from_id}`);
				el.classList.remove('load_name');
			} else if (fetch_names.includes(from_id) == false) fetch_names.push(from_id);
		}
		await fetchNames(fetch_names);
		document.querySelectorAll('.preload:not(.load_name)').forEach((e) => { e.remove(); });
	} finally {
		setTimeout(loadNames, 1000);
	}
}

async function fetchNames(fetch_names) {
	try {
		if (fetch_names.length > 0) {
			console.log('Fetching', fetch_names.length, 'names', fetch_names);
			let names = await esi.doJsonRequest('https://esi.evetech.net/universe/names', 'POST', esi.mimetype_json, JSON.stringify(fetch_names))
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
	const char = await esi.doJsonRequest(`https://esi.evetech.net/characters/${character_id}`);
	return char.name;
}

async function fetchIDFromName(the_name) {
	try {
		return await esi.doJsonRequest('https://esi.evetech.net/universe/ids', 'POST', esi.mimetype_json, JSON.stringify([the_name]));
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
		if (from_el.classList.contains('left-img')) from_el.style.order = getStrOrder(name_record.name);
	}
	esi.lsSet(`name-${id}`, name_record.name);
}

function createEl(tag, innerHTML, id = '', classes = [], attributes = {}, events = {}) {
	let el = document.createElement(tag);
	el.innerHTML = innerHTML;

	id = id || '';
	if (id.length > 0) el.id = id;

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
	try {
		let status = await esi.doRequest('https://esi.evetech.net/status/');
		let data = await status.json();
		setTqStatus(data);
	} catch (e) {
		showToast('Error fetching  TQ Status... :(')
	}
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
	let recipients = [{ type: 'character', info: { id: current_mail.from, name: esi.lsGet(`name-${current_mail.from}`) || 'Unknown Name' } }];

	if (all_recips) {
		for (const recip of current_mail.recipients) {
			if (recip.recipient_id != esi.whoami.character_id) { // don't include ourselves
				recipients.push({ type: recip.recipient_type, info: { id: recip.recipient_id, name: esi.lsGet(`name-${recip.recipient_id}`) || 'Unknown Name' } });
			}
		}
	}
	//console.log(recipients);

	btn_compose('Re: ' + current_mail.subject, "\n\n=====\n\n" + current_mail.body, recipients);
}

function btn_compose(subject = '', body = '', recipients = []) {
	document.getElementById('btn_addAlli').disabled = (esi.whoami.alliance_id == 0);
	document.getElementById('btn_group_ml').innerHTML = '';
	for (const [id, label] of Object.entries(labels)) {
		if (label.esi.mailing_list_id > 0) {
			let btn = createEl('button', label.esi.name, null, 'btn btn-info mb-2', { type: 'button', ml_id: label.esi.mailing_list_id }, { click: btn_addML });
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
	btn_viewRight();
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
	addComposeRecipient('corporation', { id: esi.whoami.corporation_id, name: esi.whoami.corporation_name });
}

function btn_addAlli() {
	addComposeRecipient('alliance', { id: esi.whoami.alliance_id, name: esi.whoami.alliance_name });
}

function btn_addML() {
	addComposeRecipient('mailing_list', { id: this.getAttribute('ml_id'), name: this.innerText });
}

function addComposeRecipient(type, info) {
	if (document.getElementById(`#compose_recipients_calculated .recip_id_${info.id}`)) return true;
	let span = createEl('span', info.name, null, 'recip_id_${info.id} compose_recipient left-img', { recip_id: info.id, recip_type: type });
	applyLeftImage(span, type, info.id, esi.whoami.corporation_id, esi.whoami.alliance_id);
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
		if (recips.length >= 50) return alert('You must have 50 recipients or less.');

		let subject = document.getElementsByName('compose_subject')[0].value.trim();
		if (subject.length == 0) return alert('You have not added a subject.');
		if (subject.length > 150) return alert('Subject must be 150 characters or less.');

		let body = document.getElementById('compose_body_textarea').innerHTML;
		body = body.replace('&nbsp;', ' ').trim();
		if (body.length == 0) return alert('You have not added any content.');
		if (body.length > 8000) return alert('Content must be 8000 characters or less.');

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

		let res = await esi.doAuthRequest(`https://esi.evetech.net/characters/${esi.whoami.character_id}/mail`, 'POST', esi.mimetype_json, JSON.stringify(msg));
		if (res.status == 201) {
			// success!
			document.getElementById('compose_recipients_calculated').innerHTML = '';
			document.getElementsByName('compose_subject')[0].value = '';
			document.getElementById('compose_body_textarea').innerHTML = '';
			showToast('EveMail has been sent...');

			fetchNewMail(parseInt(await res.text() || '0'));
			return btn_backToFolder();
		}
		console.log(res);
		alert('There was an error sending your evemail' + (res.error ? ':<br/><br/>' + res.error : ''));
	} finally {
		sending_evemail = false;
	}
}

async function fetchNewMail(new_mail_id) {
	try {
		if (new_mail_id > 0) {
			await addMailHeader(await getMail(new_mail_id, false));
			updateUnreadCounts();
		}
	} catch (e) {
		console.error(e);
	}
}

async function btn_markReadStatus(e) {
	return await pm_updateReadStatus(await getMail(current_mail_id), this.dataset.read != "true");
}

async function btn_deleteMail(e, mail_id = null, no_prrompt = false) {
	if (no_prrompt == false && ! await confirm('Are you sure you wwant to PERMANENTLY delete this evemail?')) return;

	mail_id = mail_id ?? current_mail_id;

	console.log('DELETING', mail_id);

	let url = `https://esi.evetech.net/characters/${esi.whoami.character_id}/mail/${mail_id}`;
	let res = await esi.doAuthRequest(url, 'DELETE', esi.mimetype_json);
	if (res.status == 204) {
		let mail_header = document.getElementById(`mail_header_${mail_id}`)
		if (mail_header) mail_header.remove(); // for that rare instance it gets removed elsewhere while the user deletes

		esi.lsDel(`mail-${mail_id}`);
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
	return '1' + (str || '').toLowerCase().slice(0, 3).split('').map(c => c.charCodeAt(0).toString().padStart(3, '0')).join('');
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

function panel_view(el_id, visible) {
	const el = document.getElementById(el_id);
	if (visible) el.classList.remove('xs-hideit');
	else el.classList.add('xs-hideit');
}

function btn_viewRight() {
	//console.log('showing rightpanel')
	panel_view('leftpanel', false);
	panel_view('rightpanel', true);
}

function btn_viewLeft() {
	// if we're viewing an evemail, just go back to the folder
	if (!document.getElementById('mail_container_full').classList.contains('d-none')) return btn_backToFolder();

	//console.log('showing leftpanel')
	panel_view('leftpanel', true);
	panel_view('rightpanel', false);
}

function showToast(message, duration = 3000) {
	// Ensure a container exists
	let container = document.getElementById('toast-container');
	if (!container) {
		container = document.createElement('div');
		container.id = 'toast-container';
		document.body.appendChild(container);
	}

	// Create toast element
	const toast = document.createElement('div');
	toast.className = 'toast';
	toast.innerHTML = message;

	container.appendChild(toast);

	_setTimeout(() => { toast.classList.add('show'); }, 0);
	_setTimeout(() => { toast.remove(); }, 3000);
	toast.addEventListener('click', () => { toast.remove(); return false; });
}