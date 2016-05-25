<?php


function checkErrormsg()
{
	global $php_errormsg;
	$fp = fopen("file.txt","wb");
	echo $php_errormsg;
	$txt = "I like biscuits\n";
	fwrite($fp, $txt);
	fclose($fp);
	echo "Testing";
	return $php_errormsg;
}


$host = "127.0.0.1";
$port = 4022;
// No Timeout 
set_time_limit(0);

//Create socket
$socket = socket_create(AF_INET, SOCK_STREAM, 0);
if ($socket == FALSE) {
	socket_close($socket);
	die("Could not create socket\n");
}

//Bind socket to host and port
$result = socket_bind($socket, $host, $port);
if ($result == FALSE) {
	socket_close($socket);
	die("Could not bind to socket\n");
}

//Start listening to a client that will connect
$result = socket_listen($socket, 3);
if ($result == FALSE) {
	socket_close($socket);
	die("Could not set up socket listener\n");
}

//Accept incoming transmission by creating another socket
$spawn = socket_accept($socket);
if ($spawn == FALSE) {
	socket_close($spawn);
	socket_close($socket);
	die("Could not accept incoming connection\n");
}

//Read message from client
$input = socket_read($spawn, 1024);
if ($input == FALSE){
	socket_close($spawn);
	socket_close($socket);
	die("Could not read input\n");
}

//Create file
$fp = fopen("file.txt","wb");
fwrite($fp, $input);
fclose($fp);

//Reverse message
$output = strrev($input) . "\n";

//Send message to client
socket_write($spawn, $output, strlen ($output));

//Close sockets
socket_close($spawn);
socket_close($socket);
?>
