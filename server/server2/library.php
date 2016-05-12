<?php
function create_file() {
	$filename = uniqid('CEU', true) . '.ceu';
	//echo $filename;
	$fp = fopen($filename, "wb");
	fwrite($fp, "I put something in it");
	fclose($fp);
}
?>
