#include <stdlib.h>
#include <stdio.h>

#include "SDL.h"

SDL_Window* SDL_CreateWindow(const char *title, int x, int y, int w, int h, Uint32 flags) {
	SDL_Window *window;
	return window;
}

SDL_Renderer* SDL_CreateRenderer(SDL_Window* window, int index, int flags) {
	SDL_Renderer *renderer;
	return renderer;
}

SDL_Surface* SDL_GetWindowSurface(SDL_Window *window) {
	SDL_Surface *surface;
	return surface;
}

void SDL_DestroyWindow(SDL_Window* window) {
}

void SDL_DestroyRenderer(SDL_Renderer* renderer) {
}

void SDL_FreeSurface(SDL_Surface* surface) {
}