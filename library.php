<?php

function create_file($data) {
	//We create a temporary ceu file that will hold the code from client
	//The file WILL be created in /tmp
	$file = tempnam("./", 'CEU');
	$filename_ceu = $file . '.ceu';
	$filename_html = $file . '.html';
	$filename_js = $file . '.js';

	//Extract just the name of the file(considering it's in /tmp)
	$token  = strtok($filename_ceu, '/');
	$token = strtok('/');

	//Put the code into the file
	file_put_contents($filename_ceu, $data);

	//Change directory
	chdir("/tmp/");
	//Run ceu on the file
	exec("ceu ".$token);
	
	
//$function =  "~/emsdk_portable/emscripten/master/emcc hello.c -o hello.html -s EMTERPRETIFY=1 -s EMTERPRETIFY_ASYNC=1 -s EXPORTED_FUNCTIONS=\"['_begin', '_update', '_main']\" -s NO_EXIT_RUNTIME=1 --shell-file custom_shell.html";
	
	//Run emscripten
	$function =  "~/emsdk_portable/emscripten/master/emcc main.c -o " . $filename_html . " -s EXPORTED_FUNCTIONS=\"['_begin', '_update', '_async_call', '_main']\" -s NO_EXIT_RUNTIME=1 --shell-file custom_shell.html --pre-js custom.js";
	exec($function);
	//echo $filename_html . "\n";



/*
	//Delete the files
	unlink($file);
	unlink($filename_html);
	unlink($filename_ceu);
	unlink("_ceu_app.c");
	unlink("_ceu_app.h");

	*/
	return $filename_js;
}

?>
