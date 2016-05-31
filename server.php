<?php

if (strcmp($_POST["code"], "") !== 0)
	echo file_get_contents("files/hello.js");

?>
