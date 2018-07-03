<?php

namespace podmail;

class ESI
{
    public static function fail(&$guzzler, $params, $ex)
    {
        $code = $ex->getCode();
        switch ($code) {
            case 0:
            case ($code >= 500):
                // Can be ignored
                break;
            case 420:
                $guzzler->finish();
                exit();
                break;
            default:
                echo "ESI: " . $ex->getCode() . " " . $ex->getMessage() . "\n";
        }
    }
}
