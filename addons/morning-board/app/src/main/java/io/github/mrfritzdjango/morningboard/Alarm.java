package io.github.mrfritzdjango.morningboard;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.res.Resources;
import android.os.Build;

import java.time.ZoneId;

/** The morning board at wake_hour:wake_minute (options.xml): an alarm-clock alarm that opens BoardActivity, set again each time. */
final class Alarm {
    private Alarm() {
    }

    static void schedule(Context context) {
        Resources res = context.getResources();
        int hour = res.getInteger(R.integer.wake_hour);
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        PendingIntent open = PendingIntent.getActivity(context, 7,
                BoardActivity.alarmIntent(context),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        if (hour < 0) {
            alarms.cancel(open);
            return;
        }
        long at = Times.nextAt(System.currentTimeMillis(), ZoneId.systemDefault(), hour, res.getInteger(R.integer.wake_minute));
        if (Build.VERSION.SDK_INT >= 31 && !alarms.canScheduleExactAlarms()) {
            // Without the exact-alarm permission: near the time, and Android may not let it open over another app.
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, open);
        } else {
            alarms.setAlarmClock(new AlarmManager.AlarmClockInfo(at, open), open);
        }
    }
}
