<?php


echo 'Hello ' . htmlspecialchars($_POST["name"]) . '!';
//$filename = uniqid('CEU', true) . '.ceu';
//echo $filename;
//$fp = fopen("/home/vic/git/Ceu-Emscripten/server/server2/fisier.txt", "wb");
//fwrite($fp, $_POST["name"]);
//fclose($fp);
$file = tempnam("./", 'CEU');
//file_put_contents($file.'.ceu', $_POST["name"]);
//{
   //use your file
	//exec('./a.out /tmp/'.$file.'.ceu /home/vic/git/'.$file.'.ceu', $out);
	//print_r($out);
//}
//unlink($file);//to delete an empty file that tempnam creates
//unlink($file.'.extension');//to delete your file
?>
