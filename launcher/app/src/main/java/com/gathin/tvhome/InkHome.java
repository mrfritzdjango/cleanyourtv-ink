package com.gathin.tvhome;

import io.github.mrfritzdjango.ink.Animals;
import io.github.mrfritzdjango.ink.CoverView;
import io.github.mrfritzdjango.ink.Playing;
import io.github.mrfritzdjango.ink.ShowView;
import io.github.mrfritzdjango.ink.Shows;
import io.github.mrfritzdjango.ink.SongBlock;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.res.Resources;
import android.database.ContentObserver;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.LayerDrawable;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Random;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * ink_home (config.xml): Home as an e-ink page. A text list (Calendar and Tasks from the Today add-on, then the dock
 * apps, Screensaver and Settings), the big clock, and while Calendar or Tasks is selected a preview of it in the space
 * above the clock, read from Today's provider because Home has no network. While Spotify plays, Today's NowPlaying puts
 * the song at the top right (cover in ink dots, NOW PLAYING, song, artist), and with the Spotify row selected the
 * larger view takes its place: OK opens Spotify, OK held pauses or plays. Selection is an inverted ink bar; the only
 * motion is the preview simply swapping, with no flash. Every 30 seconds an animal from Today crosses the whole screen in its own way
 * (its pass, played by ShowView over everything; keys still work under it), TITANE every fifth time. Night ink from
 * 19:30 to 07:00. The fonts, the animals and their shows are Today's own (read through createPackageContext), so the
 * launcher carries no copy of them. MainActivity hands its view, lifecycle and keys here and sets up nothing else.
 */
final class InkHome {
    static final String TODAY = "io.github.mrfritzdjango.morningboard";
    private static final Uri AGENDA = Uri.parse("content://" + TODAY + ".agenda/today");
    private static final Uri NOW = Uri.parse("content://" + TODAY + ".agenda/now");
    private static final float DESIGN_WIDTH = 1920f;
    private static final int PAPER = 0xFFE6E5DF;
    private static final int INK = 0xFF1C1C1A;
    private static final int MUTED = 0xFF4A4A46;
    private static final int NIGHT_PAPER = 0xFF121211;
    private static final int NIGHT_INK = 0xFFCFCEC8;
    private static final int NIGHT_MUTED = 0xFFA3A29C;
    private static final LocalTime NIGHT_START = LocalTime.of(19, 30);
    private static final LocalTime NIGHT_END = LocalTime.of(7, 0);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("EEE d MMM", Locale.ENGLISH);
    private static final int CALENDAR = 0;
    private static final int TASKS = 1;
    private static final int APP = 2;
    private static final int SETTINGS = 3;
    private static final int SAVER = 4;
    /** The preview of the song, with its app's row selected. */
    private static final int SONG = 5;
    private static final int NONE = -1;
    /** Design pixels: the previews' top, and their gap below the song block when it shows (its top follows the list's first row). */
    private static final float PREVIEW_TOP = 150;
    private static final float UNDER_SONG = 148;
    /** The song preview's progress line moves on this often. */
    private static final long TICK_MS = 10_000;
    private static final String TITANE = "titan-triggerfish";
    /** TITANE takes one pass in this many. */
    private static final int TITANE_EVERY = 5;

    private static final class Item {
        final int kind;
        final String label;
        final String pkg;

        Item(int kind, String label, String pkg) {
            this.kind = kind;
            this.label = label;
            this.pkg = pkg;
        }
    }

    private final Activity activity;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Runnable minute = this::onMinute;
    private final Runnable pass = this::onPass;
    private final Random coin = new Random();
    private final List<String> dockApps;
    private final List<Item> items = new ArrayList<>();
    private final float scale;
    private final Typeface regular;
    private final Typeface bold;
    private final FrameLayout root;
    private final LinearLayout list;
    private final TextView clock;
    private final TextView date;
    private final FrameLayout preview;
    private final SongBlock songBlock;
    private final Runnable tick = this::onTick;
    /** The animal passing by, over everything else. */
    private final ShowView passing;
    private final ContentObserver observer;
    private final ContentObserver songObserver;
    /** Today's animals (read again when Today is updated) and the index of their shows; the io thread's only. */
    private List<Animals.Animal> animals;
    private long animalsVersion;
    private Shows shows;
    private boolean resumed;
    /** Today's last answer, null when there is none from today. */
    private JSONObject agenda;
    /** There is an answer, but from an earlier day: the previews wait for today's. */
    private boolean agendaStale;
    private LocalDate agendaDay;
    /** The song Today follows, null when none. */
    private Playing song;
    /** The song preview's moving parts, while it is on screen. */
    private ProgressLine progress;
    private TextView elapsed;
    /** OK went down on the song's row: it opens the app when it comes up, unless it was held (play/pause). */
    private boolean okOnSong;
    private boolean okHeld;
    private int selected;
    private int shownPreview = NONE;
    private int shownTop = -1;
    /** The top of the list's first row, in pixels: the song block sits level with it. */
    private int firstRowTop;
    private boolean night;
    private boolean coloured;
    private int paper = PAPER;
    private int ink = INK;
    private int muted = MUTED;

    InkHome(Activity activity, List<String> dockApps) {
        this.activity = activity;
        this.dockApps = dockApps;
        Resources res = activity.getResources();
        scale = res.getDisplayMetrics().widthPixels / DESIGN_WIDTH;
        regular = todayFont(activity, "atkinson_regular", Typeface.NORMAL);
        bold = todayFont(activity, "atkinson_bold", Typeface.BOLD);
        buildItems();

        root = new FrameLayout(activity);
        list = new LinearLayout(activity);
        list.setOrientation(LinearLayout.VERTICAL);
        list.setGravity(Gravity.CENTER_VERTICAL);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(px(820), ViewGroup.LayoutParams.MATCH_PARENT);
        lp.leftMargin = px(216);
        root.addView(list, lp);

        preview = new FrameLayout(activity);
        FrameLayout.LayoutParams pp = new FrameLayout.LayoutParams(px(688), px(500), Gravity.TOP | Gravity.END);
        pp.rightMargin = px(216);
        pp.topMargin = px(PREVIEW_TOP);
        root.addView(preview, pp);

        songBlock = new SongBlock(activity, regular, bold, scale);
        FrameLayout.LayoutParams sp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP | Gravity.END);
        sp.rightMargin = px(240);
        root.addView(songBlock, sp);
        list.addOnLayoutChangeListener((v, l, t, r, b, ol, ot, or, ob) -> {
            // the list is centred, so its first row moves with the number of rows: the block and the previews follow
            int top = list.getChildCount() == 0 ? 0 : list.getTop() + list.getChildAt(0).getTop();
            if (top == firstRowTop) return;
            firstRowTop = top;
            main.post(this::showPreview);
        });

        LinearLayout block = new LinearLayout(activity);
        block.setOrientation(LinearLayout.VERTICAL);
        block.setGravity(Gravity.END);
        clock = text(180, false);
        clock.setLetterSpacing(-0.02f);
        date = text(34, false);
        block.addView(clock, wrap(0));
        block.addView(date, wrap(10));
        FrameLayout.LayoutParams bp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM | Gravity.END);
        bp.rightMargin = px(240);
        bp.bottomMargin = px(120);
        root.addView(block, bp);

        passing = new ShowView(activity, bold);
        passing.setShakeTarget(root);   // when TITANE lands, the whole page shakes
        root.addView(passing, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        observer = new ContentObserver(main) {
            @Override
            public void onChange(boolean selfChange) {
                loadAgenda();
            }
        };
        songObserver = new ContentObserver(main) {
            @Override
            public void onChange(boolean selfChange) {
                loadSong();
            }
        };
    }

    View view() {
        return root;
    }

    /**
     * The rows: Calendar and Tasks when Today is installed, the dock apps that are, Screensaver, then Settings last.
     * Built again each time Home comes back, so an app installed or removed meanwhile shows up.
     */
    private void buildItems() {
        Item was = items.isEmpty() ? null : items.get(selected);
        items.clear();
        PackageManager pm = activity.getPackageManager();
        boolean today = installed(pm, TODAY);
        if (today) {
            items.add(new Item(CALENDAR, "Calendar", null));
            items.add(new Item(TASKS, "Tasks", null));
        }
        for (String pkg : dockApps) {
            if (items.size() >= 8) break;   // one list of at most eight rows
            try {
                ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
                if (!info.enabled || launchIntent(pm, pkg) == null) continue;
                items.add(new Item(APP, pm.getApplicationLabel(info).toString(), pkg));
            } catch (PackageManager.NameNotFoundException ignored) {
                // a dock app that is not installed is left out, as on the stock Home
            }
        }
        if (today) items.add(new Item(SAVER, "Screensaver", null));   // under the apps
        items.add(new Item(SETTINGS, "Settings", null));   // the last row, a little apart
        selected = 0;
        for (int i = 0; was != null && i < items.size(); i++) {
            Item it = items.get(i);
            if (it.kind == was.kind && TextUtils.equals(it.pkg, was.pkg)) selected = i;   // the bar stays on its row
        }
    }

    /** One of Today's fonts (res/font), so the launcher needs no copy; the system sans when Today is missing. */
    @android.annotation.SuppressLint("DiscouragedApi")   // another app's resource: only its name is known here
    private static Typeface todayFont(Context context, String name, int style) {
        try {
            Resources r = context.createPackageContext(TODAY, 0).getResources();
            int id = r.getIdentifier(name, "font", TODAY);
            if (id != 0) return r.getFont(id);
        } catch (PackageManager.NameNotFoundException | Resources.NotFoundException ignored) {
            // no Today, or an older one without the font
        }
        return Typeface.create(Typeface.SANS_SERIF, style);
    }

    void onResume() {
        buildItems();
        render();
        loadAgenda();
        // Today fetches a fresh agenda when it was not fetched in the last minutes (its RefreshReceiver).
        activity.sendBroadcast(new Intent(TODAY + ".REFRESH").setPackage(TODAY));
        try {
            activity.getContentResolver().registerContentObserver(AGENDA, false, observer);
            activity.getContentResolver().registerContentObserver(NOW, false, songObserver);
        } catch (SecurityException ignored) {
            // Today missing, or signed with another key: no previews
        }
        loadSong();
        onMinute();
        resumed = true;
        main.removeCallbacks(pass);
        main.postDelayed(pass, untilNextPass());
    }

    void onPause() {
        resumed = false;
        main.removeCallbacks(pass);
        passing.stop();
        main.removeCallbacks(minute);
        main.removeCallbacks(tick);
        activity.getContentResolver().unregisterContentObserver(observer);
        activity.getContentResolver().unregisterContentObserver(songObserver);
        okOnSong = false;
    }

    void onNewIntent() {
        if (selected != 0) {
            selected = 0;   // Home on Home: back to the top of the list
            render();
        }
    }

    void onDestroy() {
        main.removeCallbacksAndMessages(null);
        io.shutdownNow();
    }

    private void onMinute() {
        main.removeCallbacks(minute);
        boolean n = isNight();
        if (n != night || !coloured) render();
        clock.setText(clockText(LocalTime.now()));
        date.setText(DATE.format(LocalDate.now()));
        if (agendaDay != null && !agendaDay.equals(LocalDate.now())) {
            // midnight with Home on screen: yesterday's agenda is no longer today's
            loadAgenda();
            activity.sendBroadcast(new Intent(TODAY + ".REFRESH").setPackage(TODAY));
        } else if (shownPreview != NONE) {
            shownPreview = NONE;   // the next event moves on with the clock
            showPreview();
        } else {
            showPreview();   // a song paused ten minutes ago goes
        }
        long now = System.currentTimeMillis();
        main.postDelayed(minute, 60_000 - now % 60_000 + 50);
    }

    // ---- An animal passing by every 30 seconds, at :15 and :45 (the clock changes on the minute)

    private static long untilNextPass() {
        long now = System.currentTimeMillis();
        return 30_000 - (now + 15_000) % 30_000;
    }

    private void onPass() {
        main.removeCallbacks(pass);
        main.postDelayed(pass, untilNextPass() + 50);
        if (passing.playing()) return;
        int inkNow = ink, paperNow = paper, width = activity.getResources().getDisplayMetrics().widthPixels;
        int dir = coin.nextBoolean() ? 1 : -1;
        io.execute(() -> {
            try {
                // Today's own files: an updated Today brings new animals and shows, and its props are layer numbers,
                // so the drawings are read again with the shows whenever Today changes
                Context today = activity.createPackageContext(TODAY, 0);
                long version = activity.getPackageManager().getPackageInfo(TODAY, 0).lastUpdateTime;
                if (animals == null || version != animalsVersion) {
                    animals = Animals.load(today);
                    animalsVersion = version;
                }
                shows = Shows.open(today.getAssets());
            } catch (PackageManager.NameNotFoundException e) {
                return;   // no Today: no animals
            }
            Animals.Animal a = next();
            Shows.Show show = a == null ? null : shows.load(a.id, true);
            if (show == null) return;
            float k = width / ShowView.DESIGN_WIDTH;
            ShowView.Drawing drawing = ShowView.draw(a, shows.props(a.id), show.fit * k, inkNow, paperNow, 12 * k);
            main.post(() -> {
                if (resumed && !passing.playing()) passing.play(show, drawing, true, dir, null);
            });
        });
    }

    /** The next animal to pass: every animal with a show in turn, and TITANE one pass in TITANE_EVERY. */
    private Animals.Animal next() {
        if (shows == null) return null;
        List<Animals.Animal> others = new ArrayList<>();
        Animals.Animal titane = null;
        for (Animals.Animal a : animals) {
            if (!shows.has(a.id)) continue;
            if (TITANE.equals(a.id)) titane = a;
            else others.add(a);
        }
        SharedPreferences prefs = activity.getSharedPreferences("ink_home", Context.MODE_PRIVATE);
        int n = prefs.getInt("passes", 0);
        prefs.edit().putInt("passes", n + 1).apply();
        if (titane != null && (n % TITANE_EVERY == TITANE_EVERY - 1 || others.isEmpty())) return titane;
        return others.isEmpty() ? null : others.get((n - n / TITANE_EVERY) % others.size());
    }

    private boolean isNight() {
        if (activity.getResources().getBoolean(R.bool.ink_night_always)) return true;
        LocalTime t = LocalTime.now();
        return !t.isBefore(NIGHT_START) || t.isBefore(NIGHT_END);
    }

    private void loadAgenda() {
        io.execute(() -> {
            JSONObject result = null;
            long updated = 0;
            try (Cursor c = activity.getContentResolver().query(AGENDA, null, null, null, null)) {
                if (c != null && c.moveToFirst()) {
                    result = new JSONObject(c.getString(0));
                    updated = c.getLong(1);
                }
            } catch (Exception ignored) {
                // no Today, no permission, or nothing fetched yet: the preview says so
            }
            LocalDate day = Instant.ofEpochMilli(updated).atZone(ZoneId.systemDefault()).toLocalDate();
            boolean stale = result != null && !day.equals(LocalDate.now());
            JSONObject r = stale ? null : result;
            main.post(() -> {
                agenda = r;
                agendaStale = stale;
                agendaDay = r == null ? null : day;
                shownPreview = NONE;   // rebuild the preview with the new day
                showPreview();
            });
        });
    }

    /** The song from Today's NowPlaying, off the main thread. */
    private void loadSong() {
        io.execute(() -> {
            Playing p = null;
            try (Cursor c = activity.getContentResolver().query(NOW, null, null, null, null)) {
                p = Playing.from(c);
            } catch (Exception ignored) {
                // no Today, an older one, or no permission: no song
            }
            Playing got = p;
            main.post(() -> {
                song = got;
                if (shownPreview == SONG) shownPreview = NONE;   // the preview shows the new song
                showPreview();
            });
        });
    }

    /** A song to show now: playing, or paused less than ten minutes ago. */
    private boolean songShown() {
        return song != null && song.shownAt(System.currentTimeMillis());
    }

    /** The row of the app playing the song (the Spotify row). */
    private boolean songRow(Item it) {
        return it.kind == APP && songShown() && song.pkg.equals(it.pkg);
    }

    // ---- Keys: up and down move the bar in the list, OK opens (held on the Spotify row: pause or play), Menu =
    // launcher settings. Left and right do nothing.

    boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();
        boolean ours = code == KeyEvent.KEYCODE_DPAD_UP || code == KeyEvent.KEYCODE_DPAD_DOWN
                || code == KeyEvent.KEYCODE_DPAD_LEFT || code == KeyEvent.KEYCODE_DPAD_RIGHT
                || code == KeyEvent.KEYCODE_DPAD_CENTER || code == KeyEvent.KEYCODE_ENTER
                || code == KeyEvent.KEYCODE_NUMPAD_ENTER || code == KeyEvent.KEYCODE_MENU;
        if (!ours) return false;
        boolean ok = code == KeyEvent.KEYCODE_DPAD_CENTER || code == KeyEvent.KEYCODE_ENTER || code == KeyEvent.KEYCODE_NUMPAD_ENTER;
        if (event.getAction() != KeyEvent.ACTION_DOWN) {
            // the Spotify row opens on release, so that holding OK can pause instead
            if (ok && okOnSong && !okHeld && !event.isCanceled()) open(items.get(selected));
            if (ok) okOnSong = false;
            return true;
        }
        switch (code) {
            case KeyEvent.KEYCODE_DPAD_UP:
                select(Math.max(0, selected - 1));
                break;
            case KeyEvent.KEYCODE_DPAD_DOWN:
                select(Math.min(items.size() - 1, selected + 1));
                break;
            case KeyEvent.KEYCODE_DPAD_LEFT:
            case KeyEvent.KEYCODE_DPAD_RIGHT:
                break;
            case KeyEvent.KEYCODE_MENU:
                start(new Intent(activity, LauncherSettingsActivity.class));
                break;
            default:
                Item it = items.get(selected);
                if (event.getRepeatCount() == 0) {
                    okOnSong = songRow(it);
                    okHeld = false;
                    if (!okOnSong) open(it);
                } else if (okOnSong && !okHeld) {
                    okHeld = true;   // held: Today pauses or plays; the preview follows when Spotify says so
                    activity.sendBroadcast(new Intent(TODAY + ".PLAYPAUSE").setPackage(TODAY));
                }
        }
        return true;
    }

    private void select(int index) {
        if (index == selected) return;
        selected = index;
        render();
    }

    private void open(Item item) {
        switch (item.kind) {
            case CALENDAR:
            case TASKS:
                start(new Intent().setComponent(new ComponentName(TODAY, TODAY + ".BoardActivity"))
                        .putExtra("screen", item.kind == CALENDAR ? "calendar" : "tasks"));
                break;
            case APP:
                Intent launch = launchIntent(activity.getPackageManager(), item.pkg);
                if (launch != null) start(launch);
                break;
            case SAVER:
                // Today's screensaver as a page: the same animals and clock, any key comes back to Home
                start(new Intent().setComponent(new ComponentName(TODAY, TODAY + ".SaverActivity")));
                break;
            default:
                start(new Intent(Settings.ACTION_SETTINGS));
        }
    }

    private void start(Intent intent) {
        try {
            activity.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (ActivityNotFoundException | SecurityException ignored) {
            // nothing answers: stay on Home
        }
    }

    private static Intent launchIntent(PackageManager pm, String pkg) {
        Intent i = pm.getLeanbackLaunchIntentForPackage(pkg);
        return i != null ? i : pm.getLaunchIntentForPackage(pkg);
    }

    private static boolean installed(PackageManager pm, String pkg) {
        try {
            return pm.getApplicationInfo(pkg, 0).enabled;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    // ---- Drawing

    private void render() {
        boolean n = isNight();
        if (n != night || !coloured) {
            night = n;
            coloured = true;
            paper = n ? NIGHT_PAPER : PAPER;
            ink = n ? NIGHT_INK : INK;
            muted = n ? NIGHT_MUTED : MUTED;
            root.setBackground(paper(activity.getResources(), n));
            // under the page too: when TITANE lands the page shakes, and its edges must show paper, not nothing
            activity.getWindow().setBackgroundDrawable(new ColorDrawable(paper));
            clock.setTextColor(ink);
            date.setTextColor(ink);
            passing.colours(ink, paper);
            shownPreview = NONE;
        }
        list.removeAllViews();
        for (int i = 0; i < items.size(); i++) {
            Item it = items.get(i);
            // a gap between Calendar and Tasks and the apps below them, and before Settings at the bottom
            if (i > 0 && (items.get(i - 1).kind == TASKS || it.kind == SETTINGS)) list.addView(new View(activity), new LinearLayout.LayoutParams(1, px(28)));
            TextView t = text(42, false);
            t.setText(it.label);
            t.setPadding(px(24), px(12), px(24), px(12));
            boolean on = i == selected;
            t.setTextColor(on ? paper : ink);
            if (on) t.setBackgroundColor(ink);
            LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            p.topMargin = px(4);
            list.addView(t, p);
        }
        showPreview();
    }

    /**
     * The preview above the clock follows the selection, swapping at once: Calendar's, Tasks', or with the Spotify row
     * the song's in place of the block at the top right. While the block shows, the previews start under it.
     */
    private void showPreview() {
        Item it = items.get(selected);
        boolean playing = songShown();
        int want = it.kind == CALENDAR || it.kind == TASKS ? it.kind : songRow(it) ? SONG : NONE;
        boolean block = playing && want != SONG;
        songBlock.show(block ? song : null, ink, muted, paper, night);
        FrameLayout.LayoutParams sp = (FrameLayout.LayoutParams) songBlock.getLayoutParams();
        if (sp.topMargin != firstRowTop) {
            sp.topMargin = firstRowTop;
            songBlock.setLayoutParams(sp);
        }
        int top = block ? firstRowTop + px(UNDER_SONG) : px(PREVIEW_TOP);
        if (want == shownPreview && top == shownTop) return;
        shownPreview = want;
        shownTop = top;
        FrameLayout.LayoutParams pp = (FrameLayout.LayoutParams) preview.getLayoutParams();
        pp.topMargin = top;
        pp.height = block ? px(440) : px(500);   // under the block it stops short of the clock too
        preview.setLayoutParams(pp);
        fillPreview();
    }

    /** Puts the page for the selection shown now on screen. */
    private void fillPreview() {
        preview.removeAllViews();
        main.removeCallbacks(tick);
        progress = null;
        elapsed = null;
        if (shownPreview == CALENDAR) preview.addView(calendarPreview());
        else if (shownPreview == TASKS) preview.addView(tasksPreview());
        else if (shownPreview == SONG) preview.addView(songPreview(items.get(selected).label));
    }

    /** The song, larger: the cover in ink dots beside its title, artist and album, the progress line, the keys. */
    private View songPreview(String app) {
        LinearLayout col = column();
        col.addView(label(song.playing ? "NOW PLAYING" : "PAUSED"));
        LinearLayout row = row();
        row.setGravity(Gravity.BOTTOM);
        CoverView cover = new CoverView(activity);
        cover.set(song.cover, 40, ink, paper, night);
        row.addView(cover, new LinearLayout.LayoutParams(px(260), px(260)));
        LinearLayout words = new LinearLayout(activity);
        words.setOrientation(LinearLayout.VERTICAL);
        TextView title = text(54, true, song.title, ink);
        title.setSingleLine(false);
        title.setMaxLines(2);   // a long title takes two lines, then …
        words.addView(title, wrap(0));
        words.addView(text(36, false, song.artist, ink), wrap(10));
        // a single's album has the song's name: said once is enough
        if (!song.album.isEmpty() && !song.album.equals(song.title)) words.addView(text(28, false, song.album, muted), wrap(8));
        LinearLayout.LayoutParams wp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        wp.leftMargin = px(36);
        row.addView(words, wp);
        add(col, row, 30);
        if (song.duration > 0) {
            progress = new ProgressLine();
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, px(6));
            lp.topMargin = px(30);
            col.addView(progress, lp);
            LinearLayout times = row();
            elapsed = text(26, false, "", muted);
            times.addView(elapsed, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            times.addView(text(26, false, Playing.time(song.duration), muted), wrap(0));
            add(col, times, 12);
            onTick();
        }
        add(col, text(26, false, "OK opens " + app + " · hold OK to " + (song.playing ? "pause" : "play"), muted), 30);
        return col;
    }

    /** The progress line and the time so far, again every TICK_MS while the song plays. */
    private void onTick() {
        main.removeCallbacks(tick);
        if (progress == null || song == null) return;
        long at = song.positionAt(SystemClock.elapsedRealtime());
        progress.set(song.duration > 0 ? at / (float) song.duration : 0);
        elapsed.setText(Playing.time(at));
        if (song.playing && resumed) main.postDelayed(tick, TICK_MS);
    }

    private View calendarPreview() {
        LinearLayout col = column();
        col.addView(label("TODAY"));
        JSONArray events = agenda == null ? null : agenda.optJSONArray("events");
        if (agenda == null) {
            add(col, text(40, false, agendaStale ? "Waiting for today's agenda" : "Open Today once to fetch your day", muted), 12);
        } else if (events == null || events.length() == 0) {
            add(col, text(40, false, "Nothing on the calendar", muted), 12);
        } else {
            long now = System.currentTimeMillis();
            int next = -1;
            for (int i = 0; i < events.length(); i++) {
                JSONObject e = events.optJSONObject(i);
                if (!e.optBoolean("allDay") && e.optLong("endMs") > now) {
                    next = i;
                    break;
                }
            }
            for (int i = 0; i < Math.min(4, events.length()); i++) {
                JSONObject e = events.optJSONObject(i);
                LinearLayout row = row();
                row.addView(text(40, i == next, e.optString("time"), ink), new LinearLayout.LayoutParams(px(152), ViewGroup.LayoutParams.WRAP_CONTENT));
                row.addView(text(40, i == next, e.optString("title"), ink), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
                add(col, row, 24);
            }
        }
        JSONObject nextDay = agenda == null || events == null || events.length() > 0 ? null : agenda.optJSONObject("nextDay");
        JSONArray later = nextDay == null ? null : nextDay.optJSONArray("events");
        JSONArray tomorrow = agenda == null ? null : agenda.optJSONArray("tomorrow");
        if (later != null && later.length() > 0) {
            // nothing today: the next day that has something, laid out like today
            add(col, label(nextDay.optString("label")), 56);
            for (int i = 0; i < Math.min(4, later.length()); i++) {
                JSONObject e = later.optJSONObject(i);
                LinearLayout row = row();
                row.addView(text(40, false, e.optString("time"), ink), new LinearLayout.LayoutParams(px(152), ViewGroup.LayoutParams.WRAP_CONTENT));
                row.addView(text(40, false, e.optString("title"), ink), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
                add(col, row, 24);
            }
        } else if (tomorrow != null && tomorrow.length() > 0) {
            JSONObject t = tomorrow.optJSONObject(0);
            add(col, text(30, false, "Tomorrow · " + t.optString("time") + " " + t.optString("title"), muted), 36);
        }
        return col;
    }

    private View tasksPreview() {
        LinearLayout col = column();
        JSONArray tasks = agenda == null ? null : agenda.optJSONArray("tasks");
        int open = tasks == null ? 0 : tasks.length();
        col.addView(label(open + " OPEN"));
        if (agenda == null) {
            add(col, text(40, false, agendaStale ? "Waiting for today's tasks" : "Open Today once to fetch your tasks", muted), 12);
        } else if (open == 0) {
            add(col, text(40, false, "No open tasks", muted), 12);
        }
        for (int i = 0; i < Math.min(3, open); i++) {
            JSONObject t = tasks.optJSONObject(i);
            LinearLayout row = row();
            row.addView(new Box(), new LinearLayout.LayoutParams(px(30), px(30)));
            row.addView(new View(activity), new LinearLayout.LayoutParams(px(28), 1));
            row.addView(text(40, false, t.optString("title"), ink), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            String due = t.optString("due");
            if (!due.isEmpty()) {
                LinearLayout.LayoutParams dp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                dp.leftMargin = px(20);   // a long title ellipsizes before the due day instead of running into it
                row.addView(text(26, "overdue".equals(due), due, "overdue".equals(due) ? ink : muted), dp);
            }
            add(col, row, 24);
        }
        JSONArray done = agenda == null ? null : agenda.optJSONArray("doneToday");
        if (done != null && done.length() > 0) add(col, text(30, false, done.length() + " done today", muted), 36);
        return col;
    }

    /** Paper with a faint fixed grain, the same as the Today add-on's. */
    private static Drawable paper(Resources res, boolean night) {
        int n = 128;
        int[] px = new int[n * n];
        Random random = new Random(7);
        for (int i = 0; i < px.length; i++) {
            int v = random.nextInt(256);
            px[i] = Color.argb(random.nextInt(night ? 10 : 18), v, v, v);
        }
        BitmapDrawable grain = new BitmapDrawable(res, Bitmap.createBitmap(px, n, n, Bitmap.Config.ARGB_8888));
        grain.setTileModeXY(Shader.TileMode.REPEAT, Shader.TileMode.REPEAT);
        return new LayerDrawable(new Drawable[] {new ColorDrawable(night ? NIGHT_PAPER : PAPER), grain});
    }

    private static String clockText(LocalTime t) {
        return t.getHour() + (t.getMinute() < 10 ? ":0" : ":") + t.getMinute();
    }

    private int px(float design) {
        return Math.round(design * scale);
    }

    private TextView text(float size, boolean isBold) {
        TextView t = new TextView(activity);
        t.setTypeface(isBold ? bold : regular);
        t.setTextSize(TypedValue.COMPLEX_UNIT_PX, size * scale);
        t.setIncludeFontPadding(false);
        t.setSingleLine(true);
        t.setEllipsize(TextUtils.TruncateAt.END);
        return t;
    }

    private TextView text(float size, boolean isBold, String s, int color) {
        TextView t = text(size, isBold);
        t.setText(s);
        t.setTextColor(color);
        return t;
    }

    private TextView label(String s) {
        TextView t = text(24, true, s, ink);
        t.setLetterSpacing(0.12f);
        return t;
    }

    private LinearLayout row() {
        LinearLayout r = new LinearLayout(activity);
        r.setOrientation(LinearLayout.HORIZONTAL);
        r.setGravity(Gravity.CENTER_VERTICAL);
        return r;
    }

    private LinearLayout column() {
        LinearLayout c = new LinearLayout(activity);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setPadding(px(24), 0, px(24), 0);
        return c;
    }

    private void add(LinearLayout parent, View v, float topGap) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.topMargin = px(topGap);
        parent.addView(v, p);
    }

    private LinearLayout.LayoutParams wrap(float topGap) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.topMargin = px(topGap);
        return p;
    }

    /** The song's progress: a thin track in faded ink with the part played as a thicker ink bar over it. */
    private final class ProgressLine extends View {
        private final Paint paint = new Paint();
        private float done;

        ProgressLine() {
            super(activity);
        }

        void set(float share) {
            done = Math.max(0, Math.min(1, share));
            invalidate();
        }

        @Override
        protected void onDraw(Canvas canvas) {
            float h = getHeight();
            paint.setColor(Color.argb(70, Color.red(ink), Color.green(ink), Color.blue(ink)));
            canvas.drawRect(0, h / 2 - px(1), getWidth(), h / 2 + px(1), paint);
            paint.setColor(ink);
            canvas.drawRect(0, 0, getWidth() * done, h, paint);
        }
    }

    /** A task's square outline in ink. */
    private final class Box extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);

        Box() {
            super(activity);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(3 * scale);
            paint.setColor(ink);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            float s = paint.getStrokeWidth() / 2;
            canvas.drawRect(s, s, getWidth() - s, getHeight() - s, paint);
        }
    }
}
