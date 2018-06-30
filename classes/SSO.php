<?php

namespace podmail;

class SSO
{
    public static function getAccessToken(array $config, int $char_id, string $refresh_token, \cvweiss\Guzzler $guzzler, string $success, string $fail, array $params = [])
    {
        $params['char_id'] = $char_id;
        $params['config'] = $config;
        $params['success'] = $success;
        $params['refresh_token'] = $refresh_token;

        // Do we have a cached version?
        $db = $config['db'];
        $db->delete('access_tokens', ['expires' => ['$lte' => time()]]);
        $row = $db->queryDoc('access_tokens', ['character_id' => $char_id, 'refresh_token' => $refresh_token]);
        if (isset($row['access_token'])) {
            $raw = json_encode(['access_token' => $row['access_token']]);
            $success($guzzler, $params, $raw);
            return;
        }

        $url = 'https://login.eveonline.com/oauth/token';
        $headers = ['Authorization' =>'Basic ' . base64_encode($config['ccp']['clientID'] . ':' . $config['ccp']['secretKey']), "Content-Type" => "application/json"];
        $guzzler->call($url, '\podmail\SSO::accessTokenFetchComplete', $fail, $params, $headers, 'POST', json_encode(['grant_type' => 'refresh_token', 'refresh_token' => $refresh_token]));
    }

    public static function accessTokenFetchComplete($guzzler, $params, $content)
    {
        $json = json_decode($content, true);
        $access_token = $json['access_token'];
        $ttl = $json['expires_in'];
        $params['config']['db']->insert('access_tokens', ['character_id' => $params['char_id'], 'refresh_token' => $params['refresh_token'], 'access_token' => $access_token, 'expires' => (time() + $ttl - 120)]);
        $params['success']($guzzler, $params, $content);
    }
}
