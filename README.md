## Folders
* css <- contains the css files (NOT YET IMPLEMENTED)
* img <- contains the images used by the client (NOT YET IMPLEMENTED)
* IMPORTANT FILES <- contains the files used by install.sh
* js <- contains the javascript files used by client (PARTIALLY IMPLEMENTED)
* temp <- a temporary working directory used for debugging
* tutorials <- the source files for the example codes (WILL ADD THE EXPLANATIONS AS WELL)

## Files
* client.html <- the html code for the client
* install.sh <- a script that puts the necessary files used for compiling(needs root privileges). It amuses that the Apache chroot is in /tmp/ . MUST BE USED EVERY TIME THE COPTER RESTARTS
* library.php <- a php file that receives ceu code and converts it into a javascript file
* server.php <- a php file that receives the code from the client and with library.php sends it to the client

## Requirements to run
* emscripten
* ceu
* apache2
* php
* javascript

## How to run (ONLY FOR LINUX)
* Create a shortcut in your apache2 RootDirectory(default /var/www/ or /var/www/html/) towards the location of the folder
* When running for the first time use install.sh
* Otherwise use start.sh
* Open client.html in your browser, select the tutorial and press Run.
