# Folders
* css <- contains the css files (NOT YET IMPLEMENTED)
* img <- contains the images used by the client (NOT YET IMPLEMENTED)
* IMPORTANT FILES <- contains the files used by install.sh
* js <- contains the javascript files used by client (PARTIALLY IMPLEMENTED)
* temp <- a temporary working directory used for debugging
* tutorials <- the source files for the example codes (WILL ADD THE EXPLANATIONS AS WELL)

# Files
* client.html <- the html code for the client
* install.sh <- a script that puts the necessary files used for compiling(needs root privileges). It amuses that the Apache chroot is in /tmp/ . MUST BE USED EVERY TIME THE COPTER RESTARTS
* library.php <- a php file that receives ceu code and converts it into a javascript file
* server.php <- a php file that receives the code from the client and with library.php sends it to the client

# Requirements to run
* emscripten
* ceu
* apache2
* php
* javascript

# Steps needed in order for it to work(Linux only)
## Installing CMAKE
* sudo apt-get install cmake

## Installing Emscripten Portable (version 1.3X)
* download it from http://kripken.github.io/emscripten-site/docs/getting_started/downloads.html#sdk-download-and-install
* Enter in the folder and execute
* ./emsdk update
* ./emsdk install latest
* ./emsdk activate latest

## Installing Apache2
* sudo apt-get update
* sudo apt-get install apache2
* sudo /etc/init.d/apache2 restart

## Installing php5
* sudo apt-get install php libapache2-mod-php php-mcrypt

## Installing nodejs
* sudo apt-get install nodejs

## Installing git
* sudo apt-get install git

## Installing Lua
* sudo apt-get install lua5.1
* sudo apt-get install lua-lpeg

## Installing Ceu(optional)
* git clone https://github.com/fsantanna/ceu
* cd ceu/
* lua pak.lua
* ./run_tests.lua
* cp ceu /usr/local/bin/

## Installing SDL2.0
* sudo apt-get install libsdl2-dev

## Getting Ceu-Emscripten
* git clone https://github.com/VicentiuM/Ceu-Emscripten.git

## Setting apache2 Document Root (optional)
* follow the tutorial posted at http://julienrenaux.fr/2015/04/06/changing-apache2-document-root-in-ubuntu-14-x/ or any other tutorial

## Setting Shortcut in DocumentRoot
* ln -s /full/path/to/Ceu-Emscripten ceu
* run install.sh when using for the first time, otherwise use start.sh

## Opening the server in your browser
* put the following URL http://localhost/ceu/client.html
