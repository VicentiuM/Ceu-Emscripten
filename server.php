<?php

if (strcmp($_POST["code"], "") !== 0) {

	include 'library.php';
	$filename = create_js($_POST["code"]);
	$filename_copy = $filename;

	//Get the extension of the filename
	$pieces = explode('.', $filename);
	$extension = array_pop($pieces);

	$response = array();

	//If the ceu file compiled successfully
	if ($extension == "js") {
		$response['status'] = 'success';
        $response['message'] = file_get_contents($filename_copy);
	}
	//If the ceu file had errors
	else {
		$response['status'] = 'error';
        $response['message'] = file_get_contents($filename_copy);
	}

	//Send to server the response
	echo json_encode($response);

	unlink($filename_copy);

}

?>
