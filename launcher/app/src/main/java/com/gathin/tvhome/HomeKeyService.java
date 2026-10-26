package com.gathin.tvhome;

import android.accessibilityservice.AccessibilityService;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.view.KeyEvent;
import android.view.accessibility.AccessibilityEvent;

/**
 * Sends the remote's Home button to this launcher on remotes that emit KEYCODE_ALL_APPS for Home (Xiaomi sticks and
 * boxes). Android TV 9 routes that key only to the system-image launcher, so once the stock launcher is disabled the
 * button does nothing. Every other key passes through untouched.
 *
 * Off unless asked for: HOME_KEY_SERVICE=1 launcher/build-and-install.sh, or over adb
 *   settings put secure enabled_accessibility_services com.gathin.tvhome/.HomeKeyService
 *   settings put secure accessibility_enabled 1
 */
public class HomeKeyService extends AccessibilityService {
    @Override
    protected boolean onKeyEvent(KeyEvent event) {
        if (event.getKeyCode() != KeyEvent.KEYCODE_ALL_APPS) return false;
        if (event.getAction() == KeyEvent.ACTION_UP && !event.isCanceled()) {
            Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
                    .setClass(this, MainActivity.class)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
            try {
                startActivity(home);
            } catch (ActivityNotFoundException | SecurityException ignored) {
                // nothing to do: the key is still eaten, as the firmware would have dropped it anyway
            }
        }
        return true;   // the down and the up both stay here
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // keys only: res/xml/home_key_service.xml subscribes to no events
    }

    @Override
    public void onInterrupt() {
    }
}
