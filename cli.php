<?php

$fpr1 = fopen($argv[1], "r");

$data = file_get_contents($argv[1]);
echo $data;

include 'library.php';
create_file($data);

fclose($fpr1);
?>
