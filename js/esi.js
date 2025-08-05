let esi;

(() => {
	try {
		const localhost = window.location.hostname === 'localhost';
		const ssoLocalClientId = 'c53caf7892b14b71bd305b1997fe58fb';
		const ssoPublicClientId = '82427996be1a4b23aa65175880599c96';

		const callbackUrl =
			window.location.protocol +
			'//' +
			window.location.hostname +
			(window.location.port === '' ? '' : ':' + window.location.port) +
			'/auth.html';

		esi = new SimpleESI({
			clientID: localhost ? ssoLocalClientId : ssoPublicClientId,
			callbackUrl,
			scopes: [
				"publicData",
				"esi-mail.organize_mail.v1",
				"esi-mail.read_mail.v1",
				"esi-mail.send_mail.v1"
			]
		});
	} catch (e) {
		console.log(e);
	}
})();