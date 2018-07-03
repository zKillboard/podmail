<?php

namespace podmail;

// Where are we?
$baseDir = dirname(__FILE__);
// Make sure all execution starts from this base path
chdir($baseDir);

// Load dependencies
require_once 'vendor/autoload.php';

// Read configuration file
$configFile = $baseDir . '/config.json';
if (!file_exists($configFile)) throw new \Exception("Missing config file.");
$raw = file_get_contents($configFile);
$configValues = json_decode($raw, true);
$config = ['baseDir' => dirname(__FILE__)];
foreach ($configValues as $key=>$value) $config[$key] = $value;

// Preapre the database
$config['db'] = new Db($config);

// Preprae Redis
$redis = new \Redis();
$redis->pconnect($config['redis']['server'], $config['redis']['port']);
$redis->clearLastError();
$config['redis'] = $redis;
