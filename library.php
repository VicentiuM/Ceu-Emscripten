<?php

function create_file($data) {
	$filename = uniqid('CEU', true) . '.ceu';
	//We create a temporary ceu file that will hold the code from client
	$fp = fopen("files/".$filename, "wb");
	//Put the code into the file
	fwrite($fp, $data);
	//Run ceu on the file
	chdir('files');
	exec("ceu ".$filename);
	$function =  "~/emsdk_portable/emscripten/master/emcc hello.c -o hello.html -s EMTERPRETIFY=1 -s EMTERPRETIFY_ASYNC=1 -s EXPORTED_FUNCTIONS=\"['_begin', '_update', '_main']\" -s NO_EXIT_RUNTIME=1 --shell-file custom_shell.html";
	exec($function);
	fclose($fp);

	unlink($filename);
	unlink("_ceu_app.c");
	unlink("_ceu_app.h");
}

?>
