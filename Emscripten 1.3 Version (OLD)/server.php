<?php

if (strcmp($_POST["code"], "") !== 0) {

	include 'library.php';
	$filename_js = create_js($_POST["code"]);

	echo file_get_contents($filename_js);

	unlink($filename_js);

}

?>
