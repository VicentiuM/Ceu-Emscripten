This will be a ceu program compiled with emscripten
When you press the Update button it executes the ceu-to-c file that prints a "Hello World!" message
To compile use: emcc hello.c -o hello.html -s EXPORTED_FUNCTIONS="['_begin', '_update']" --shell-file custom_shell.html
