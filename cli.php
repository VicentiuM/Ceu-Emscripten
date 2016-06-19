<?php

$fpr1 = fopen($argv[1], "r");

$data = file_get_contents($argv[1]);
echo $data;

include 'library.php';
$filename_js = create_file($data);


echo $filename_js . "\n";
fclose($fpr1);
?>
