package io.github.mrfritzdjango.morningboard;

import android.app.Activity;
import android.os.Bundle;
import android.view.KeyEvent;

/**
 * The screensaver as a page, opened from Home's Screensaver row (or am start -n
 * io.github.mrfritzdjango.morningboard/.SaverActivity). Left and right change the animal; volume reaches the TV; any
 * other key leaves, when it is let go, so a key still held does not go on to move Home's list. It does not keep the
 * screen on: the TV's own sleep timer still turns it off, as over any other app.
 * --es animal <id> starts on that animal and sends it on its outing straight away, to try a show.
 */
public final class SaverActivity extends Activity {
    private SaverView saver;
    /** A key went down here: Home's OK, which opened this page, comes up here and must not close it again. */
    private boolean pressed;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        saver = new SaverView(this);
        setContentView(saver);
        String animal = getIntent().getStringExtra("animal");
        if (animal != null) saver.pick(animal);   // kept until the animals are read
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();
        if (AnimalDream.volume(code)) return super.dispatchKeyEvent(event);
        if (code == KeyEvent.KEYCODE_DPAD_LEFT || code == KeyEvent.KEYCODE_DPAD_RIGHT) {
            if (event.getAction() == KeyEvent.ACTION_DOWN) saver.step(code == KeyEvent.KEYCODE_DPAD_RIGHT ? 1 : -1);
            return true;
        }
        if (event.getAction() == KeyEvent.ACTION_DOWN) pressed = true;
        else if (pressed) finish();   // like the screensaver: any other key leaves
        return true;
    }
}
