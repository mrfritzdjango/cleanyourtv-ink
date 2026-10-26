package com.gathin.tvhome;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.KeyEvent;

import java.util.Arrays;

/**
 * The launcher's one screen, the Home activity. Everything on it is the e-ink Home (InkHome): this hands it the view,
 * the lifecycle and the keys, and gives it the dock_apps from config.xml as the apps to start with.
 */
public class MainActivity extends Activity {
    private InkHome ink;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ink = new InkHome(this, Arrays.asList(getResources().getStringArray(R.array.dock_apps)));
        setContentView(ink.view());   // InkHome sets the window's background to its paper
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent != null && intent.hasCategory(Intent.CATEGORY_HOME)) ink.onNewIntent();
    }

    @Override
    protected void onResume() {
        super.onResume();
        ink.onResume();
    }

    @Override
    protected void onPause() {
        ink.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        ink.onDestroy();
        super.onDestroy();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        return ink.dispatchKeyEvent(event) || super.dispatchKeyEvent(event);
    }

    @Override
    @SuppressWarnings("deprecation")   // still how a Home activity ignores Back on API 26 to 32
    public void onBackPressed() {
        // Home screen: Back goes nowhere.
    }
}
