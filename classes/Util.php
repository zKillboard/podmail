<?php

namespace podmail;

class Util 
{
    public static function getGuzzler($config, $maxConcurrent = 10)
    {
        return new \cvweiss\Guzzler($maxConcurrent, 1, 'podmail - ' . $config['domain']);
    }
}
