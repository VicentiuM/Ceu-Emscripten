# Folders
* css <- contains the css files
* img <- contains the images used by the client
* src <- contains the files used by start.sh
* js <- contains the javascript files used by client
* tutorials <- the source files for the example codes
* Emscripten 1.3 Version(OLD) <- is a version that used emscripten portable.
* tests <- a folder with all kinds of tests, making sure that the client works.

# Files
* README.md <- the README file
* client.html <- the html code for the client
* library.php <- a php file that receives ceu code and converts it into a javascript file
* server.php <- a php file that receives the code from the client and with library.php sends it to the client
* start.sh <- a script that will copy the files from src to the /tmp/ folder

# Requirements to run
* emscripten > 1.10
* ceu
* apache2
* php
* javascript

# Steps needed in order for it to work(Linux only)

## Installing Emscripten
* sudo apt-get install emscripten

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

## Installing Ceu
* git clone https://github.com/fsantanna/ceu
* cd ceu/
* lua pak.lua
* ./run_tests.lua
* cp ceu /usr/local/bin/

## Getting Ceu-Emscripten
* git clone https://github.com/VicentiuM/Ceu-Emscripten.git

## Setting apache2 Document Root (optional)
* follow the tutorial posted at http://julienrenaux.fr/2015/04/06/changing-apache2-document-root-in-ubuntu-14-x/ or any other tutorial

## Setting Shortcut in DocumentRoot
* cd /var/www/
* ln -s /full/path/to/Ceu-Emscripten ceu

## Opening the server in your browser
* run the start.sh script
* put the following URL http://localhost/ceu/client.html
