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
	exec("./ceu ".$filename_ceu);
		
	//$emcc = "/home/vic/emsdk_portable/emscripten/master/emcc";
	
	//$function =  $emcc . " main.c -o " . $filename_js . " -O2 --memory-init-file 0 -s EXPORTED_FUNCTIONS=\"['_begin', '_update', '_async_call', '_key_down', '_key_up', '_mouse_down', '_mouse_up', '_mouse_move', '_disable_events', '_enable_events']\" -s NO_EXIT_RUNTIME=1 -s USE_SDL=2";
	$function =  "emcc main.c -o " . $filename_js . " -O1 --memory-init-file 0 -s EXPORTED_FUNCTIONS=\"['_begin', '_update', '_async_call', '_key_down', '_key_up', '_mouse_down', '_mouse_up', '_mouse_move', '_disable_events', '_enable_events']\" -s NO_EXIT_RUNTIME=1 --js-library sdl_library.js";
	

	exec($function);


	//Delete the files
	
	unlink($token);
	unlink($filename_ceu);
	//unlink($filename_js.'.map');
	unlink("_ceu_app.c");
	unlink("_ceu_app.h");
	


	return $filename_js;
}

?>
