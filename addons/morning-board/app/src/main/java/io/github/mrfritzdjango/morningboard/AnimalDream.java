package io.github.mrfritzdjango.morningboard;

import android.service.dreams.DreamService;
import android.view.KeyEvent;

/**
 * The system screensaver: an ink animal and the clock (SaverView). Left and right change the animal; any other key
 * wakes the TV back to where it was. Google TV has no menu for other screensavers, so it is chosen over ADB:
 * settings put secure screensaver_components io.github.mrfritzdjango.morningboard/.AnimalDream
 */
public final class AnimalDream extends DreamService {
    private SaverView saver;

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        setInteractive(true);   // so left and right reach us; everything else still wakes the TV (below)
        setFullscreen(true);
        saver = new SaverView(this);
        setContentView(saver);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();
        if (code == KeyEvent.KEYCODE_DPAD_LEFT || code == KeyEvent.KEYCODE_DPAD_RIGHT) {
            if (event.getAction() == KeyEvent.ACTION_DOWN) saver.step(code == KeyEvent.KEYCODE_DPAD_RIGHT ? 1 : -1);
            return true;
        }
        finish();
        return true;
    }
}
