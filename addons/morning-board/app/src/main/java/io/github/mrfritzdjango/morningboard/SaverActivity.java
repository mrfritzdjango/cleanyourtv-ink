package io.github.mrfritzdjango.morningboard;

import android.app.Activity;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.WindowManager;

/**
 * The screensaver as a page, opened from Home's Screensaver row (or am start -n
 * io.github.mrfritzdjango.morningboard/.SaverActivity). Left and right change the animal; any other key leaves.
 * --es animal <id> starts on that animal and sends it on its outing straight away, to try a show.
 */
public final class SaverActivity extends Activity {
    private SaverView saver;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        saver = new SaverView(this);
        setContentView(saver);
        String animal = getIntent().getStringExtra("animal");
        if (animal != null) saver.pick(animal);   // kept until the animals are read
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_DPAD_LEFT || keyCode == KeyEvent.KEYCODE_DPAD_RIGHT) {
            saver.step(keyCode == KeyEvent.KEYCODE_DPAD_RIGHT ? 1 : -1);
            return true;
        }
        finish();   // like the screensaver: any other key leaves
        return true;
    }
}
