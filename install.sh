#!/bin/bash
echo "Please insert the full path to your emscripten portable folder"
echo "Example: /home/user_name/emsdk_portable/emscripten"
read emscripten_path

if [ "${emscripten_path: -1}" == "/" ]; then
	emscripten_path=${emscripten_path::-1}
fi

emscripten_path_full="$emscripten_path/master/emcc"
touch path.php
echo "<?php" > path.php
echo "\$emcc = \"$emscripten_path_full\";" >> path.php
echo "?>" >> path.php




echo "Please insert the path to your Apache2 DirectoryRoot"
echo "If it is the default apache2 of /var/www or /var/www/html you will need ROOT privileges"
echo "WARNING: Make sure it's full path so use /home/user/... and NOT ~/..."
read root_path
cp -r ~/.emscripten* $root_path

./start.sh