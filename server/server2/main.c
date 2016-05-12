#include <stdio.h>
#include <stdlib.h>
int main(int argc, char *argv[]) {
	if (argc == 3) {
		char mode[] = "0777";
		int i = strtol(mode, 0, 8);
		if (chmod(argv[1], i) < 0) {
			printf("Error Change Priviliges");
		}
		if(rename(argv[1], argv[2]) == -1) {
			printf("Error Move File");
		}
	}
	return 0;
}
