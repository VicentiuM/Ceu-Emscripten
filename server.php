<?php

if (strcmp($_POST["code"], "") !== 0)
	echo file_get_contents("files/hello.js");

switch( $_POST["code-tutorial"] ) {

	case 1:
		echo file_get_contents("tutorials/ex010_hello.ceu");
		break;
	case 2:
		echo file_get_contents("tutorials/ex020_events.ceu");
		break;
	case 3:
		echo file_get_contents("tutorials/ex030_parand.ceu");
		break;
	case 4:
		echo file_get_contents("tutorials/ex040_paror.ceu");
		break;
	case 5:
		echo file_get_contents("tutorials/ex050_term.ceu");
		break;
	case 6:
		echo file_get_contents("tutorials/ex060_par.ceu");
		break;
	case 7:
		echo file_get_contents("tutorials/ex070_AB.ceu");
		break;

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
