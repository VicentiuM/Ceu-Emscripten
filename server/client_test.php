<form method="post" action="">   
Code: <textarea name="Code" rows="40" cols="80"></textarea>    
Input: <textarea name="Input" rows="40" cols="80"></textarea>
<input type="submit" name = "submit" value="Send">  
</form>


<?php
$host = "127.0.0.1";
$port = 4011;
// No Timeout 
set_time_limit(0);

//Create socket
$socket = socket_create(AF_INET, SOCK_STREAM, 0);
if ($socket == FALSE) {
	socket_close($socket);
	die("Could not create socket\n");
}

//Connect to server
$result = socket_connect($socket, $host, $port);
if ($result == FALSE) {
	socket_close($socket);
	 die("Could not connect to server\n");
}

//$var = 'your value';
//echo '<textarea class="box">'.$var.'</textarea>';

if(isset($_POST['submit'])) { 
	
	$message = $_POST['Code'];

	//Send message to server
	socket_write($socket, $message, strlen($message));

	//Read message from server
	$result = socket_read ($socket, 1024);
	echo "Reply From Server  :".$result;
}

//Close socket
socket_close($socket);
?>
