package io.github.mrfritzdjango.morningboard;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** The launcher's e-ink Home: OK held on the Spotify row pauses the song, or plays it again (NowPlaying.toggle). */
public final class PlayPauseReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        NowPlaying.toggle();
    }
}
