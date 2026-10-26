package io.github.mrfritzdjango.morningboard;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Sets the morning alarm again after a reboot, a clock or time-zone change, or an update of the app. */
public final class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Alarm.schedule(context);
    }
}
