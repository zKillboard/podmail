<?php

namespace podmail;

class ESI
{
    public static function fail(&$guzzler, $params, $ex)
    {
        $code = $ex->getCode();
        switch ($code) {
            case 0:
            case 403:
            case ($code >= 500):
                // Can be ignored
                break;
            case 420:
                Log::log("420'ed...");
                $guzzler->finish();
                exit();
                break;
            default:
                Log::log("ESI: " . $ex->getCode() . " " . $ex->getMessage());
        }
        sleep(1);
    }

    public static function curl($config, $url, $fields = [], $accessToken = null, $callType = 'GET')
    {  
        $callType = strtoupper($callType);
        $headers = $accessToken == null ? [] : ['Authorization: Bearer ' . $accessToken];

        $url = $callType != 'GET' ? $url : $url . "?" . self::buildParams($fields);
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_USERAGENT, 'podmail - ' . $config['domain']);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        switch ($callType) {
            case 'DELETE':
            case 'PUT':
            case 'POST_JSON':
                $headers[] = "Content-Type: application/json";
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(empty($fields) ? (object) NULL : $fields, JSON_UNESCAPED_SLASHES));
                $callType = $callType == 'POST_JSON' ? 'POST' : $callType;
                break;
            case 'POST':
                curl_setopt($ch, CURLOPT_POSTFIELDS, self::buildParams($fields));
                break;
        }
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $callType);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if ($httpCode < 200 || $httpCode >= 300) {
            $retValue = ['error' => true, 'httpCode' => $httpCode, 'content' => $result];
            return json_encode($retValue);
        }
        return $result;
    }

    public static function buildParams($fields)
    {
        $string = "";
        foreach ($fields as $field=>$value) {
            $string .= $string == "" ? "" : "&";
            $string .= "$field=" . rawurlencode($value);
        }
        return $string;
    }
}
