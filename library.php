<?php

function create_js($data) {
	//We create a temporary ceu file that will hold the code from client
	//The file WILL be created in /tmp
	$file = tempnam("./", 'CEU');
	

	//Extract just the name of the file(considering it's in /tmp)
	$token  = strtok($file, '/');
	$token = strtok('/');

	$filename_ceu = $token . '.ceu';
	$filename_js = $token . '.js';


	//Change directory
	chdir("/tmp/");

	//Put the code into the file
	file_put_contents($filename_ceu, $data);

	
	//Run ceu on the file
	exec("ceu ".$filename_ceu);
	
	
	//Run emscripten
	$function =  "emcc main.c -o " . $filename_js . " -s EXPORTED_FUNCTIONS=\"['_begin', '_update', '_async_call', '_async_check']\" -s NO_EXIT_RUNTIME=1";
	exec($function);


	//Delete the files
	unlink($token);
	unlink($filename_js.'.map');
	unlink($filename_ceu);
	unlink("_ceu_app.c");
	unlink("_ceu_app.h");


	return $filename_js;
}

?>
