; FridWin Games demo: a tiny DOS .COM program used as the sample game for development.
; It counts how often it has been played in RUNS.DAT, which exercises the app's saved progress.
; Build: scripts/build-demo-game.sh
        org     100h

start:  mov     ax, 0003h               ; 80x25 colour text mode (clears the screen)
        int     10h

        mov     ax, 3D00h               ; open RUNS.DAT for reading
        mov     dx, fname
        int     21h
        jc      .bump                   ; first run: no file yet
        mov     bx, ax
        mov     ah, 3Fh                 ; read the 16-bit counter
        mov     cx, 2
        mov     dx, count
        int     21h
        mov     ah, 3Eh
        int     21h

.bump:  inc     word [count]
        mov     ah, 3Ch                 ; create/truncate RUNS.DAT
        xor     cx, cx
        mov     dx, fname
        int     21h
        jc      .show
        mov     bx, ax
        mov     ah, 40h                 ; write the counter back
        mov     cx, 2
        mov     dx, count
        int     21h
        mov     ah, 3Eh
        int     21h

.show:  mov     ah, 09h
        mov     dx, banner
        int     21h
        mov     ax, [count]
        call    printdec
        mov     ah, 09h
        mov     dx, footer
        int     21h

        xor     ah, ah                  ; wait for a key, then return to DOS
        int     16h
        ret

; Print AX as an unsigned decimal number.
printdec:
        mov     bx, 10
        xor     cx, cx
.div:   xor     dx, dx
        div     bx
        push    dx
        inc     cx
        test    ax, ax
        jnz     .div
.out:   pop     dx
        add     dl, '0'
        mov     ah, 02h
        int     21h
        loop    .out
        ret

fname   db      'RUNS.DAT', 0
count   dw      0
banner  db      13, 10
        db      '  +------------------------------------------------------+', 13, 10
        db      '  |               FRIDWIN GAMES  -  DEMO                 |', 13, 10
        db      '  +------------------------------------------------------+', 13, 10, 13, 10
        db      '  This tiny DOS program is the sample game for development.', 13, 10
        db      '  Your progress is saved by the app between sessions.', 13, 10, 13, 10
        db      '  Times played: $'
footer  db      13, 10, 13, 10, '  Press any key to exit.$'
