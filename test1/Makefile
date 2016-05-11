EMCC=~/emsdk_portable/emscripten/master/emcc

all:
	$(EMCC) hello.c -o hello.html -s EXPORTED_FUNCTIONS="['_begin', '_update', '_main']" -s NO_EXIT_RUNTIME=1 --shell-file custom_shell.html
