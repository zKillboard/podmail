<?php

$config['session']->clear();
return $response->withStatus(302)->withRedirect('/about');
