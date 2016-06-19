<?php

if (strcmp($_POST["code"], "") !== 0) {
	//echo file_get_contents("files/hello.js");
	//echo file_get_contents("temp/ex010.js");
	//$file = tempnam("./", 'CEU');
	//file_put_contents($file.'.ceu', $_POST["code"]);

	//$data = file_get_contents($file .'.ceu');
	//echo $data;

	include 'library.php';
	$filename_js = create_file($_POST["code"]);


	echo $filename_js . "\n";
	echo file_get_contents($filename_js);

	unlink($filename_js);
}


//include 'library.php';
//create_file($_POST["name"]);
//$filename = uniqid('CEU', true) . '.ceu';
//echo $filename;
//$fp = fopen("/home/vic/git/Ceu-Emscripten/server/server2/fisier.txt", "wb");
//fwrite($fp, $_POST["name"]);
//fclose($fp);
//$file = tempnam("/tmp/HA/", 'CEU');
//file_put_contents($file.'.ceu', $_POST["name"]);
//{
   //use your file
	//exec('./a.out /tmp/'.$file.'.ceu /home/vic/git/'.$file.'.ceu', $out);
//exec('./a.out heyo.txt', $out);
//print_r($out);
//}
//unlink($file);//to delete an empty file that tempnam creates
//unlink($file.'.extension');//to delete your file


?>
