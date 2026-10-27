package io.github.mrfritzdjango.morningboard;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * The launcher's e-ink Home on the Spotify row: OK held pauses the song or plays it again, Left goes to the song before,
 * Right to the next one (NowPlaying.toggle and skip).
 */
public final class TransportReceiver extends BroadcastReceiver {
    static final String PLAYPAUSE = BuildConfig.APPLICATION_ID + ".PLAYPAUSE";
    static final String PREVIOUS = BuildConfig.APPLICATION_ID + ".PREVIOUS";
    static final String NEXT = BuildConfig.APPLICATION_ID + ".NEXT";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (PLAYPAUSE.equals(action)) NowPlaying.toggle();
        else if (PREVIOUS.equals(action)) NowPlaying.skip(false);
        else if (NEXT.equals(action)) NowPlaying.skip(true);
    }
}
