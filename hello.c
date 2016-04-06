#include <stdio.h>
#include <stdlib.h>

#define ceu_out_assert(X) assert(X)
#define ceu_out_log(X) printf("%s\n", X)


// This is the C code generated by the Ceu compiler
#include "_ceu_app.c"


static byte CEU_DATA[sizeof(CEU_Main)];
static tceu_app app;


void update() {
	ceu_sys_go( &app, CEU_IN_UPDATE, NULL );
}

void begin() {
	memset(CEU_DATA, 0, sizeof(CEU_Main));
	app.data = (tceu_org*) &CEU_DATA;
	app.init = &ceu_app_init;
	app.init(&app);
}


