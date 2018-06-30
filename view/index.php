<?php

if ($char_id == 0) return $response->withStatus(302)->withRedirect('/about', 302);

$app->view->render($response, 'index.html', ['name' => $char_id]);
