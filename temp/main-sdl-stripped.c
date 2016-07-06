#include <stdio.h>


// definitely lost: 2,478 bytes in 17 blocks

#include "SDL2/SDL.h"
#include "SDL2/SDL_image.h"
#include "SDL2/SDL_mixer.h"
#include "SDL2/SDL_ttf.h"
#include "SDL2/SDL_opengl.h"


#include <assert.h>

#define ceu_out_assert(v) ceu_sys_assert(v)
void ceu_sys_assert (int v) {
    assert(v);
}

#define ceu_out_log(m,s) ceu_sys_log(m,s)
void ceu_sys_log (int mode, long s) {
    switch (mode) {
        case 0:
            printf("%s", (char*)s);
            break;
        case 1:
            printf("%lX", s);
            break;
        case 2:
            printf("%ld", s);
            break;
    }
}

#include "_ceu_app.h"

s32 WCLOCK_nxt;
#define ceu_out_wclock_set(us) WCLOCK_nxt = us;

#include "_ceu_app.c"

static char CEU_DATA[sizeof(CEU_Main)];

int main (int argc, char *argv[]) {
    int err = SDL_Init(SDL_INIT_EVERYTHING);
    if (err != 0) {
        printf("SDL_Init failed: %s\n", SDL_GetError());
        return err;
    }

    WCLOCK_nxt = CEU_WCLOCK_INACTIVE;
    u32 old = SDL_GetTicks();

    tceu_app app;
    app.data = (tceu_org*) &CEU_DATA;
    app.init = &ceu_app_init;

    app.init(&app);    /* calls CEU_THREADS_MUTEX_LOCK() */
#ifdef CEU_RET
    if (! app.isAlive)
        goto END;
#endif


    SDL_Event evt;


    for (;;)
    {
        /*
         * With    SDL_DT, 'tm=0' (update as fast as possible).
         * Without SDL_DT, 'tm=?' respects the timers.
         */


        s32 tm = -1;

    #ifdef CEU_WCLOCKS
            if (WCLOCK_nxt != CEU_WCLOCK_INACTIVE)
                tm = WCLOCK_nxt / 1000;
    #endif
    #ifdef CEU_ASYNCS
            if (app.pendingAsyncs) {
                tm = 0;
            }
    #endif


        //SDL_EventState(SDL_FINGERMOTION, SDL_IGNORE);



        int has = SDL_WaitEventTimeout(&evt, tm);

//#ifndef SIMULATION_TEST

        u32 now = SDL_GetTicks();
        s32 dt_ms = (now - old);
        assert(dt_ms >= 0);
        old = now;


        int fps_ok = 1;

        s32 dt_us = dt_ms*1000;


        if (fps_ok) {
#ifdef CEU_WCLOCKS
    #if ! (defined(CEU_IN_SDL_DT) || defined(CEU_IN_SDL_DT_))
                if (WCLOCK_nxt != CEU_WCLOCK_INACTIVE)
                {
                    //redraw = WCLOCK_nxt <= dt_us;
    #endif

   

                ceu_sys_go(&app, CEU_IN__WCLOCK, &dt_us);
    #ifdef CEU_RET
                    if (! app.isAlive)
                        goto END;
    #endif
                while (WCLOCK_nxt <= 0) {
                    s32 dt_us = 0;
                    ceu_sys_go(&app, CEU_IN__WCLOCK, &dt_us);
    #ifdef CEU_RET
                        if (! app.isAlive)
                            goto END;
    #endif
                }

    #if ! (defined(CEU_IN_SDL_DT) || defined(CEU_IN_SDL_DT_))
                }
    #endif
#endif



#ifdef CEU_IN_SDL_DT
            if (fps_ok) {
                ceu_sys_go(&app, CEU_IN_SDL_DT, &dt_ms);
            }
    #ifdef CEU_RET
                if (! app.isAlive)
                    goto END;
    #endif
            //redraw = 1;
#endif
        }

        // OTHER EVENTS
        if (has)
        {
            int handled = 1;        // =1 for defined events
            SDL_Event* evtp = &evt;
            switch (evt.type) {
                case SDL_QUIT:


#ifdef CEU_IN_SDL_QUIT
                    ceu_sys_go(&app, CEU_IN_SDL_QUIT, &evtp);
#endif
                    break;
                case SDL_WINDOWEVENT:

#ifdef CEU_IN_SDL_WINDOWEVENT
                    ceu_sys_go(&app, CEU_IN_SDL_WINDOWEVENT, &evtp);
#endif
                    break;
                case SDL_KEYDOWN:

#ifdef CEU_IN_SDL_KEYDOWN
                    ceu_sys_go(&app, CEU_IN_SDL_KEYDOWN, &evtp);
#endif
                    break;
                case SDL_KEYUP:

#ifdef CEU_IN_SDL_KEYUP
                    ceu_sys_go(&app, CEU_IN_SDL_KEYUP, &evtp);
#endif
                    break;
                case SDL_TEXTINPUT:

#ifdef CEU_IN_SDL_TEXTINPUT
                    ceu_sys_go(&app, CEU_IN_SDL_TEXTINPUT, &evtp);
#endif
                    break;
                case SDL_TEXTEDITING:

#ifdef CEU_IN_SDL_TEXTEDITING
                    ceu_sys_go(&app, CEU_IN_SDL_TEXTEDITING, &evtp);
#endif
                    break;
                case SDL_MOUSEMOTION:

#ifdef CEU_IN_SDL_MOUSEMOTION
                    ceu_sys_go(&app, CEU_IN_SDL_MOUSEMOTION, &evtp);
#endif
                    break;
                case SDL_MOUSEBUTTONDOWN:

#ifdef CEU_IN_SDL_MOUSEBUTTONDOWN
                    ceu_sys_go(&app, CEU_IN_SDL_MOUSEBUTTONDOWN, &evtp);
#endif
                    break;
                case SDL_MOUSEBUTTONUP:

#ifdef CEU_IN_SDL_MOUSEBUTTONUP
                    ceu_sys_go(&app, CEU_IN_SDL_MOUSEBUTTONUP, &evtp);
#endif
                    break;
                case SDL_FINGERDOWN:

#ifdef CEU_IN_SDL_FINGERDOWN
                    ceu_sys_go(&app, CEU_IN_SDL_FINGERDOWN, &evtp);
#endif
                    break;
                case SDL_FINGERUP:

#ifdef CEU_IN_SDL_FINGERUP
                    ceu_sys_go(&app, CEU_IN_SDL_FINGERUP, &evtp);
#endif
                    break;
                case SDL_FINGERMOTION:

#ifdef CEU_IN_SDL_FINGERMOTION
                    ceu_sys_go(&app, CEU_IN_SDL_FINGERMOTION, &evtp);
#endif
                    break;

                default:
                    handled = 0;    // undefined event
            }
#ifdef CEU_RET
            if (! app.isAlive) goto END;
#endif
            //redraw = redraw || handled;
        }


#ifdef CEU_IN_SDL_REDRAW

        //if (redraw && !SDL_PollEvent(NULL))
        if (fps_ok) {
            ceu_sys_go(&app, CEU_IN_SDL_REDRAW, NULL);
    #ifdef CEU_RET
                if (! app.isAlive)
                    goto END;
    #endif
        }

#endif

//#endif  /* SIMULATION_TEST */




/* TODO: "_" events */
#ifdef CEU_ASYNCS
        if (app.pendingAsyncs) {
            ceu_sys_go(&app, CEU_IN__ASYNC, NULL);
#ifdef CEU_RET
            if (! app.isAlive)
                goto END;
#endif
        }
#endif
    }
END:
#ifdef CEU_THREADS
    // only reachable if LOCKED
    CEU_THREADS_MUTEX_UNLOCK(&app.threads_mutex);
#endif
    SDL_Quit();         // TODO: slow
#ifdef CEU_RET
    return app.ret;
#else
    return 0;
#endif
}
