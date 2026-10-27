package io.github.mrfritzdjango.morningboard;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import java.time.ZoneId;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * The launcher's e-ink Home asks for a fresh agenda each time it comes up, every quarter of an hour while it stays up,
 * and every minute while it has nothing for today; this fetches at most every {@link #MIN_GAP_MS} after an answer from
 * today, and at most every {@link #RETRY_GAP_MS} after a failed try, so Home's previews stay current without Today
 * running in the background.
 */
public final class RefreshReceiver extends BroadcastReceiver {
    private static final long MIN_GAP_MS = 5 * 60_000L;
    /** After a try that failed (the network not up yet at boot), the next is allowed this soon. */
    private static final long RETRY_GAP_MS = 60_000L;
    /** One fetch at a time: Home can come up again while the last one is still waiting on the network. */
    private static final AtomicBoolean RUNNING = new AtomicBoolean();
    /** The last try, kept in memory: with the network down, every return to Home would otherwise try again. */
    private static volatile long lastTry;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Store.address("") == null) return;   // no script set up: nothing to fetch
        long now = System.currentTimeMillis();
        long updated = Store.prefs(context).getLong("updated", 0);
        // an answer from yesterday is never fresh: just past midnight Home asks for today's at once
        boolean fresh = now - updated < MIN_GAP_MS && Times.sameDay(updated, now, ZoneId.systemDefault());
        if (fresh || now - lastTry < RETRY_GAP_MS || !RUNNING.compareAndSet(false, true)) return;
        lastTry = now;
        PendingResult result = goAsync();
        Context app = context.getApplicationContext();
        new Thread(() -> {
            try {
                Store.fetch(app);
            } finally {
                RUNNING.set(false);
                result.finish();
            }
        }, "agenda-refresh").start();
    }
}
