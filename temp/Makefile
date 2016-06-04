all: 
	~/emsdk_portable/emscripten/master/emcc main.c -o ex040.html -s EXPORTED_FUNCTIONS="['_begin', '_update', '_async_call', '_main']" -s NO_EXIT_RUNTIME=1 --shell-file custom_shell.html
