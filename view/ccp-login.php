<?php

$factory = new \RandomLib\Factory;
$generator = $factory->getGenerator(new \SecurityLib\Strength(\SecurityLib\Strength::MEDIUM));
$state = $generator->generateString(128, "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ");
$config['session']->set('state', $state);

$ccpClientID = $config['ccp']['clientID'];
$domain = $config['domain'];
$scopes = 'esi-mail.organize_mail.v1+esi-mail.read_mail.v1+esi-mail.send_mail.v1';
$url = "https://login.eveonline.com/oauth/authorize/?response_type=code&redirect_uri=https://$domain/ccp-callback&client_id=$ccpClientID&scope=$scopes&state=$state";
return $response->withStatus(302)->withRedirect($url, 302);
