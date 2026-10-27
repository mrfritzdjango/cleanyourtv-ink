package com.gathin.tvhome;

import io.github.mrfritzdjango.ink.Animals;
import io.github.mrfritzdjango.ink.CoverView;
import io.github.mrfritzdjango.ink.Playing;
import io.github.mrfritzdjango.ink.ShowView;
import io.github.mrfritzdjango.ink.Shows;
import io.github.mrfritzdjango.ink.SongBird;
import io.github.mrfritzdjango.ink.SongBlock;
import io.github.mrfritzdjango.ink.Watched;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.res.Resources;
import android.database.ContentObserver;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
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
import android.text.SpannableString;
import android.text.Spanned;
import android.text.TextUtils;
import android.text.style.AbsoluteSizeSpan;
import android.text.style.ForegroundColorSpan;
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

import java.text.Collator;
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
 * The launcher's Home, an e-ink page. A text list (Calendar and Tasks from the Today add-on, then the dock
 * apps, Screensaver and Settings), the big clock, and while Calendar or Tasks is selected a preview of it in the middle
 * column, level with the first row, read from Today's provider because Home has no network. While Spotify plays, Today's NowPlaying puts
 * the song at the top right (cover in shades of ink, NOW PLAYING, song, artist) on every row and every settings page,
 * and with the Spotify row selected the larger view takes its place: OK opens Spotify, OK held pauses or plays, Left and
 * Right go to the song before and the next, under three marks laid out like the remote's ring. With no
 * song and a streaming app's row selected (YouTube, Netflix…), the top right shows that app's last show instead (LAST
 * WATCHED: a 16:9 frame, the title, the episode and the app), for a week after it was watched. Selection is an inverted ink bar; the only
 * motion is the preview simply swapping, with no flash. Every 30 seconds an animal from Today crosses the whole screen in its own way
 * (its pass, played by ShowView over everything; keys still work under it), TITANE every fifth time (or in turn with the others, as Settings chooses). Night ink from
 * 19:30 to 07:00, or all day with ink_night_always. The fonts, the animals and their shows are Today's own (read through createPackageContext), so the
 * launcher carries no copy of them. MainActivity hands its view, lifecycle and keys here and sets up nothing else.
 * The Settings row opens ink pages over Home: Home apps, where the owner adds, moves and removes the app rows (kept by
 * InkApps), TV settings, and how often TITANE comes by.
 */
final class InkHome {
    static final String TODAY = "io.github.mrfritzdjango.morningboard";
    private static final String STORE_PACKAGE = "com.android.vending";
    private static final Uri AGENDA = Uri.parse("content://" + TODAY + ".agenda/today");
    private static final Uri NOW = Uri.parse("content://" + TODAY + ".agenda/now");
    private static final Uri WATCHED = Uri.parse("content://" + TODAY + ".agenda/watched");
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
    /** The rows of the settings pages. */
    private static final int HOME_APPS = 6;
    private static final int TV_SETTINGS = 7;
    private static final int EDIT = 8;
    private static final int ALL = 9;
    private static final int MOVE = 11;
    private static final int REMOVE = 12;
    private static final int OPEN = 13;
    private static final int ADD = 15;
    /** All apps: the Play Store, for apps that are not on the TV yet. */
    private static final int STORE = 16;
    /** Settings: OK switches TITANE between every fifth pass and its turn with the others. */
    private static final int TITANE_ROW = 17;
    /** A line that is read, not selected. */
    private static final int NOTE = 14;
    /** The pages over Home: Settings, then Home apps, from there All apps, and from either one app's page. */
    private static final int P_HOME = 0;
    private static final int P_SETTINGS = 1;
    private static final int P_APPS = 2;
    private static final int P_APP = 3;
    private static final int P_ALL = 4;
    /** Rows on screen at once on All apps; Down from the last one turns to the next page. */
    private static final int PAGE_ROWS = 8;
    /**
     * Design pixels: Calendar's and Tasks' previews, the middle of three equal columns between the list's edge (240) and
     * the clock's (1680), which they fill; the song preview on the right, its cover's side and its width.
     */
    private static final float MIDDLE_LEFT = 720;
    private static final float MIDDLE_WIDTH = 480;
    private static final float SONG_COVER = 216;
    private static final float SONG_WIDTH = 584;
    /** The song preview's time so far moves on with each second of the song, and its progress line with it. */
    private static final long TICK_MS = 1_000;
    /** A skip's mark stays inked until Spotify moves the song, or this long at most. */
    private static final long SKIP_WAIT_MS = 3_000;
    /** Calendar's preview: at most this many of today's events. */
    private static final int PREVIEW_EVENTS = 4;
    /** Why there is no agenda for today, as Today's provider says (its Agenda.NETWORK, KEY, SCRIPT; 0 when none)… */
    private static final int NETWORK = 1;
    private static final int KEY = 2;
    private static final int SCRIPT = 3;
    /** …or as Home finds when it reads it: Today signed with another key, or an answer it cannot read. */
    private static final int OTHER_KEY = 10;
    private static final int UNREADABLE = 11;
    private static final long HOUR_MS = 60 * 60_000L;
    private static final String TITANE = "titan-triggerfish";
    /** TITANE takes one pass in this many, unless Settings put it in turn with the others (TITANE_OFTEN false). */
    private static final int TITANE_EVERY = 5;
    private static final String TITANE_OFTEN = "titane_often";

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
    /** The page open over Home, its title, rows and selected row, and the line under them. */
    private int page = P_HOME;
    private String title;
    private final List<Item> rows = new ArrayList<>();
    private int row;
    private String hint;
    /** Home apps: the row being moved with Up and Down, -1 when none. */
    private int moving = -1;
    /** The app whose page is open, and the list it was opened from (Home apps or All apps), which Back goes to. */
    private Item editing;
    private int editFrom = P_APPS;
    private boolean today;
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
    private final Runnable skipDone = () -> {
        skipping = 0;
        marks();
    };
    /** The animal passing by, over everything else. */
    private final ShowView passing;
    private final ContentObserver observer;
    private final ContentObserver songObserver;
    private final ContentObserver watchedObserver;
    /** Today's animals (read again when Today is updated) and the index of their shows; the io thread's only. */
    private List<Animals.Animal> animals;
    private long animalsVersion;
    private Shows shows;
    /** The kingfisher from Today's animals, for the song's block and its preview; null until read. */
    private Animals.Animal kingfisher;
    private boolean resumed;
    /** Home went under another app (onStop): Home pressed there comes back to the row it left from. */
    private boolean away;
    /** Minutes Home has been on screen, for asking Today for a fresh agenda every quarter of an hour. */
    private int minutes;
    /** Animal passes so far: read once, counted in memory, kept in prefs when Home goes; -1 until read. The io thread's. */
    private volatile int passes = -1;
    /** All apps' rows while its pages are open: read again when Home comes back or the pages close. */
    private List<Item> allCache;
    /** Today has its script set up (board.properties): without it the Calendar and Tasks rows are left out. */
    private boolean calendarOn = true;
    /** Today's notification listener is allowed: without it no song is ever seen, and Settings says so. */
    private boolean listening = true;
    /** Today's last answer, null when there is none from today. */
    private JSONObject agenda;
    /** When that answer came, and why the last fetch failed (NETWORK, KEY, SCRIPT, OTHER_KEY, UNREADABLE), 0 if not. */
    private long agendaUpdated;
    private int agendaProblem;
    /** There is an answer, but from an earlier day: the previews wait for today's. */
    private boolean agendaStale;
    private LocalDate agendaDay;
    /** The song Today follows, null when none. */
    private Playing song;
    /** The last show watched in each streaming app, from Today. */
    private List<Watched> watched = new ArrayList<>();
    /** The song preview's moving parts, while it is on screen. */
    private ProgressLine progress;
    private TextView elapsed;
    private SongBird songBird;
    private Mark previousMark;
    private Mark playMark;
    private Mark nextMark;
    /** Left or Right was pressed on the Spotify row (Playing.SKIP_PREVIOUS or SKIP_NEXT) and the song has not moved yet; 0 when not. */
    private int skipping;
    private Playing skippedFrom;
    /** OK went down on the song's row: it opens the app when it comes up, unless it was held (play/pause). */
    private boolean okOnSong;
    private boolean okHeld;
    private int selected;
    private int shownPreview = NONE;
    private int shownTop = -1;
    private boolean shownMiddle;
    private int shownWidth;
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
        FrameLayout.LayoutParams pp = new FrameLayout.LayoutParams(px(SONG_WIDTH), px(500), Gravity.TOP | Gravity.END);
        pp.rightMargin = px(216);
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
        watchedObserver = new ContentObserver(main) {
            @Override
            public void onChange(boolean selfChange) {
                loadWatched();
            }
        };
    }

    View view() {
        return root;
    }

    /**
     * The rows: Calendar and Tasks when Today is installed, the apps that are (chosen on the TV in Settings, Home apps,
     * or dock_apps), Screensaver, then Settings last. Built again each time Home comes back, so an app installed or
     * removed meanwhile shows up.
     */
    private void buildItems() {
        Item was = items.isEmpty() ? null : items.get(selected);
        items.clear();
        PackageManager pm = activity.getPackageManager();
        today = installed(pm, TODAY);
        if (today && calendarOn) {
            items.add(new Item(CALENDAR, "Calendar", null));
            items.add(new Item(TASKS, "Tasks", null));
        }
        for (String pkg : InkApps.load(activity, dockApps)) {
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
        allCache = null;
        // back from an app or the Play Store: the lists are read again, so an app installed meanwhile is in them
        if (page == P_APPS || page == P_ALL) openOn(page, row < rows.size() ? rows.get(row).pkg : null, row);
        render();
        loadAgenda();
        refresh();
        try {
            activity.getContentResolver().registerContentObserver(AGENDA, false, observer);
            activity.getContentResolver().registerContentObserver(NOW, false, songObserver);
            activity.getContentResolver().registerContentObserver(WATCHED, false, watchedObserver);
        } catch (SecurityException ignored) {
            // Today missing, or signed with another key: no previews
        }
        loadSong();
        loadWatched();
        onMinute();
        resumed = true;
        main.removeCallbacks(pass);
        main.postDelayed(pass, untilNextPass());
        io.execute(this::readAnimals);   // the kingfisher for the song's block, without waiting for the first pass
        away = false;
    }

    void onStop() {
        away = true;
    }

    /** Today fetches a fresh agenda when its own gaps allow (its RefreshReceiver), and Home's observer hears of it. */
    private void refresh() {
        activity.sendBroadcast(new Intent(TODAY + ".REFRESH").setPackage(TODAY));
    }

    void onPause() {
        resumed = false;
        main.removeCallbacks(pass);
        passing.stop();
        main.removeCallbacks(minute);
        main.removeCallbacks(tick);
        activity.getContentResolver().unregisterContentObserver(observer);
        activity.getContentResolver().unregisterContentObserver(songObserver);
        activity.getContentResolver().unregisterContentObserver(watchedObserver);
        okOnSong = false;
        okHeld = false;
        main.removeCallbacks(skipDone);
        skipping = 0;
        if (passes >= 0) activity.getSharedPreferences("ink_home", Context.MODE_PRIVATE).edit().putInt("passes", passes).apply();
    }

    /**
     * Home pressed. On Home: back to the top of the list. From inside an app: back on the row it was opened from (its
     * LAST WATCHED shows), as Back from it does. Either way Home closes the settings pages.
     */
    void onNewIntent() {
        if (away && page == P_HOME) return;
        page = P_HOME;
        moving = -1;
        if (!away) selected = 0;
        render();
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
        minutes++;
        boolean newDay = agendaDay != null && !agendaDay.equals(LocalDate.now());
        // Home on screen all day keeps up with the phone: Today is asked every quarter of an hour, and every minute while
        // there is nothing for today (past midnight, the network not up yet)
        if (today && calendarOn && agendaProblem != OTHER_KEY && (newDay || agenda == null || minutes % 15 == 0)) refresh();
        if (newDay) {
            loadAgenda();   // midnight with Home on screen: yesterday's agenda is no longer today's
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

    /**
     * Today's animals, read again whenever Today changes (an updated Today brings new animals and shows, and its props are
     * layer numbers), and the kingfisher handed to the song's block; Today's context, or null when there is no Today.
     * The io thread's only.
     */
    private Context readAnimals() {
        try {
            Context today = activity.createPackageContext(TODAY, 0);
            long version = activity.getPackageManager().getPackageInfo(TODAY, 0).lastUpdateTime;
            if (animals == null || version != animalsVersion) {
                animals = Animals.load(today);
                animalsVersion = version;
                Animals.Animal bird = SongBird.find(animals);
                main.post(() -> {
                    kingfisher = bird;
                    songBlock.perch(bird);
                    if (songBird != null) songBird.setBird(bird);
                });
            }
            return today;
        } catch (PackageManager.NameNotFoundException e) {
            return null;
        }
    }

    private void onPass() {
        main.removeCallbacks(pass);
        main.postDelayed(pass, untilNextPass() + 50);
        if (passing.playing()) return;
        int inkNow = ink, paperNow = paper, width = activity.getResources().getDisplayMetrics().widthPixels;
        int dir = coin.nextBoolean() ? 1 : -1;
        io.execute(() -> {
            Context today = readAnimals();
            if (today == null) return;   // no Today: no animals
            shows = Shows.open(today.getAssets());
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

    /** The next animal to pass: every animal with a show in turn, and TITANE one pass in TITANE_EVERY unless not often. */
    private Animals.Animal next() {
        if (shows == null) return null;
        boolean often = titaneOften();
        List<Animals.Animal> others = new ArrayList<>();
        Animals.Animal titane = null;
        for (Animals.Animal a : animals) {
            if (!shows.has(a.id)) continue;
            if (often && TITANE.equals(a.id)) titane = a;
            else others.add(a);
        }
        if (passes < 0) passes = activity.getSharedPreferences("ink_home", Context.MODE_PRIVATE).getInt("passes", 0);
        int n = passes++;
        if (titane == null) return others.isEmpty() ? null : others.get(n % others.size());
        if (n % TITANE_EVERY == TITANE_EVERY - 1 || others.isEmpty()) return titane;
        return others.get((n - n / TITANE_EVERY) % others.size());
    }

    private boolean titaneOften() {
        return activity.getSharedPreferences("ink_home", Context.MODE_PRIVATE).getBoolean(TITANE_OFTEN, true);
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
            int problem = 0;
            boolean configured = true;
            try (Cursor c = activity.getContentResolver().query(AGENDA, null, null, null, null)) {
                if (c != null && c.moveToFirst()) {
                    if (!c.isNull(0)) result = new JSONObject(c.getString(0));
                    updated = c.getLong(1);
                    if (c.getColumnCount() > 3) {   // an older Today has only the answer and its time
                        problem = c.getInt(2);
                        configured = c.getInt(3) != 0;
                    }
                }
            } catch (SecurityException e) {
                problem = OTHER_KEY;   // Today is there but signed with another key: Home may not read it
            } catch (Exception e) {
                problem = UNREADABLE;
            }
            LocalDate day = Instant.ofEpochMilli(updated).atZone(ZoneId.systemDefault()).toLocalDate();
            boolean stale = result != null && !day.equals(LocalDate.now());
            JSONObject r = stale ? null : result;
            long up = updated;
            int why = problem;
            boolean on = configured;
            main.post(() -> {
                agenda = r;
                agendaStale = stale;
                agendaDay = r == null ? null : day;
                agendaUpdated = up;
                agendaProblem = why;
                shownPreview = NONE;   // rebuild the preview with the new day
                if (on != calendarOn) {
                    calendarOn = on;   // the script set up, or not: Calendar and Tasks come or go
                    buildItems();
                    render();
                } else {
                    showPreview();
                }
            });
        });
    }

    /** The song from Today's NowPlaying, off the main thread. */
    private void loadSong() {
        io.execute(() -> {
            Playing p = null;
            boolean allowed = true;
            try (Cursor c = activity.getContentResolver().query(NOW, null, null, null, null)) {
                p = Playing.from(c);
                if (c != null) allowed = c.getExtras().getBoolean("listening", true);   // an older Today does not say
            } catch (Exception ignored) {
                // no Today, an older one, or no permission: no song
            }
            Playing got = p;
            boolean on = allowed;
            main.post(() -> {
                listening = on;
                if (skipping != 0 && moved(skippedFrom, got)) {
                    main.removeCallbacks(skipDone);
                    skipping = 0;
                }
                song = got;
                if (shownPreview == SONG) shownPreview = NONE;   // the preview shows the new song
                showPreview();
            });
        });
    }

    /** Spotify has acted on a skip: another song, or the same one back near its start. */
    private static boolean moved(Playing from, Playing to) {
        if (to == null || !to.title.equals(from.title)) return true;
        long now = SystemClock.elapsedRealtime();
        return to.positionAt(now) < from.positionAt(now) - 1_000;
    }

    /** The last show watched in each streaming app, from Today's NowPlaying, off the main thread. */
    private void loadWatched() {
        io.execute(() -> {
            List<Watched> w = new ArrayList<>();
            try (Cursor c = activity.getContentResolver().query(WATCHED, null, null, null, null)) {
                w = Watched.all(c);
            } catch (Exception ignored) {
                // no Today, an older one, or no permission: nothing watched
            }
            List<Watched> got = w;
            main.post(() -> {
                watched = got;
                showPreview();
            });
        });
    }

    /** The last show watched in the app of this row, if it is still shown; null when none. */
    private Watched watchedOn(Item it) {
        if (it.kind != APP) return null;
        long now = System.currentTimeMillis();
        for (Watched w : watched) if (w.pkg.equals(it.pkg) && w.shownAt(now)) return w;
        return null;
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
    // launcher settings. Left and right skip songs on the Spotify row, elsewhere nothing. On the settings pages Back goes
    // up one level.

    boolean dispatchKeyEvent(KeyEvent event) {
        if (page != P_HOME) return pageKey(event);
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
            if (ok && okHeld) {
                okHeld = false;   // the middle mark lets go
                marks();
            }
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
                // one song per press: holding the key does not run through the queue
                if (event.getRepeatCount() == 0 && songRow(items.get(selected))) {
                    skip(code == KeyEvent.KEYCODE_DPAD_RIGHT ? Playing.SKIP_NEXT : Playing.SKIP_PREVIOUS);
                }
                break;
            case KeyEvent.KEYCODE_MENU:
                openPage(P_SETTINGS, 0);   // the same Settings page as the Settings row
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
                    marks();
                }
        }
        return true;
    }

    /** Left or Right on the Spotify row: Today skips, if Spotify lets it; the mark stays inked until the song moves. */
    private void skip(int which) {
        if (!song.canSkip(which)) return;
        skipping = which;
        skippedFrom = song;
        activity.sendBroadcast(new Intent(TODAY + (which == Playing.SKIP_NEXT ? ".NEXT" : ".PREVIOUS")).setPackage(TODAY));
        main.removeCallbacks(skipDone);
        main.postDelayed(skipDone, SKIP_WAIT_MS);
        marks();
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
                openPage(P_SETTINGS, 0);
        }
    }

    private void start(Intent intent) {
        if (intent == null) return;   // the app went (disabled, uninstalled) while its row was on screen
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

    // ---- The settings pages, over Home: Settings (Home apps, TV settings); Home apps, the app rows, where the owner
    // moves and removes them; and All apps, every app on the TV, to open or add to Home, with the Play Store for more.
    // OK on an app opens its page. One list per page, like Home; Back goes up one level and Home closes them.

    private void openPage(int p, int at) {
        page = p;
        moving = -1;
        hint = null;
        rows.clear();
        PackageManager pm = activity.getPackageManager();
        switch (p) {
            case P_SETTINGS:
                title = "SETTINGS";
                rows.add(new Item(HOME_APPS, "Home apps", null));
                rows.add(new Item(TV_SETTINGS, "TV settings", null));
                if (today) rows.add(new Item(TITANE_ROW,
                        titaneOften() ? "Titane visit frequency: high" : "Titane visit frequency: low", null));
                if (today && !listening) rows.add(new Item(NOTE, "Now playing is off: see the setup guide", null));
                break;
            case P_APPS:
                title = "HOME APPS";
                for (String pkg : shownApps()) rows.add(new Item(EDIT, appName(pm, pkg), pkg));
                rows.add(new Item(ALL, "All apps", null));
                hint = "OK on an app to open, move or remove it";
                break;
            case P_APP:
                title = editing.label.toUpperCase(Locale.ROOT);
                rows.add(new Item(OPEN, "Open", null));
                if (shownApps().contains(editing.pkg)) {
                    rows.add(new Item(MOVE, "Move", null));
                    rows.add(new Item(REMOVE, "Remove from Home", null));
                } else if (shownApps().size() < InkApps.room(today && calendarOn)) {
                    rows.add(new Item(ADD, "Add to Home", null));
                } else {
                    rows.add(new Item(NOTE, "Home is full: remove an app first", null));
                }
                break;
            default:
                title = "ALL APPS";
                rows.addAll(allApps(pm));
                if (launchIntent(pm, STORE_PACKAGE) != null) rows.add(new Item(STORE, "Get more apps", null));
                if (rows.isEmpty()) rows.add(new Item(NOTE, "No apps to show", null));
                hint = "OK on an app to open it or add it to Home";
        }
        row = Math.max(0, Math.min(at, rows.size() - 1));
        if (rows.get(row).kind == NOTE) row = Math.max(0, row - 1);
        // none of Home's previews shows under a page; the song stays at the top right (showPreview)
        preview.removeAllViews();
        main.removeCallbacks(tick);
        progress = null;
        elapsed = null;
        songBird = null;
        previousMark = playMark = nextMark = null;   // a skip's end (skipDone) then has no marks to ink
        shownPreview = NONE;
        render();
    }

    /** Opens a list with the bar on an app's row, or on row {@code at} when it is not there (Get more apps). */
    private void openOn(int p, String pkg) {
        openOn(p, pkg, 0);
    }

    private void openOn(int p, String pkg, int at) {
        openPage(p, at);
        for (int i = 0; pkg != null && i < rows.size(); i++) {
            if (rows.get(i).kind == EDIT && pkg.equals(rows.get(i).pkg)) {
                row = i;
                render();
                return;
            }
        }
    }

    private void closePages() {
        closePages(true);
    }

    /** onSettings: Back from Settings lands on the Settings row; Menu, which can open them from any row, leaves the bar. */
    private void closePages(boolean onSettings) {
        page = P_HOME;
        moving = -1;
        allCache = null;
        for (int i = 0; onSettings && i < items.size(); i++) if (items.get(i).kind == SETTINGS) selected = i;
        render();
    }

    private boolean pageKey(KeyEvent event) {
        int code = event.getKeyCode();
        boolean ok = code == KeyEvent.KEYCODE_DPAD_CENTER || code == KeyEvent.KEYCODE_ENTER || code == KeyEvent.KEYCODE_NUMPAD_ENTER;
        boolean upDown = code == KeyEvent.KEYCODE_DPAD_UP || code == KeyEvent.KEYCODE_DPAD_DOWN;
        boolean ours = ok || upDown || code == KeyEvent.KEYCODE_BACK || code == KeyEvent.KEYCODE_MENU
                || code == KeyEvent.KEYCODE_DPAD_LEFT || code == KeyEvent.KEYCODE_DPAD_RIGHT;
        if (!ours) return false;
        if (event.getAction() != KeyEvent.ACTION_DOWN || (event.getRepeatCount() > 0 && !upDown)) return true;
        if (upDown) {
            int by = code == KeyEvent.KEYCODE_DPAD_UP ? -1 : 1;
            if (moving >= 0) shift(by);
            else step(by);
        } else if (code == KeyEvent.KEYCODE_BACK) {
            back();
        } else if (code == KeyEvent.KEYCODE_MENU) {
            closePages(false);   // Menu opened them; Menu again puts them away
        } else if (ok) {
            choose(rows.get(row));
        }
        return true;
    }

    /** The bar to the next row that can be chosen, a line that is only read skipped. */
    private void step(int by) {
        for (int i = row + by; i >= 0 && i < rows.size(); i += by) {
            if (rows.get(i).kind == NOTE) continue;
            row = i;
            render();
            return;
        }
    }

    private void back() {
        if (moving >= 0) {
            putDown();
            return;
        }
        switch (page) {
            case P_APP:
                openOn(editFrom, editing.pkg);
                break;
            case P_ALL:
                openPage(P_APPS, shownApps().size());   // on All apps
                break;
            case P_APPS:
                openPage(P_SETTINGS, 0);
                break;
            default:
                closePages();
        }
    }

    private void choose(Item it) {
        switch (it.kind) {
            case HOME_APPS:
                openPage(P_APPS, 0);
                break;
            case TV_SETTINGS:
                start(new Intent(Settings.ACTION_SETTINGS));
                break;
            case TITANE_ROW:
                activity.getSharedPreferences("ink_home", Context.MODE_PRIVATE).edit()
                        .putBoolean(TITANE_OFTEN, !titaneOften()).apply();
                openPage(P_SETTINGS, row);
                break;
            case EDIT:
                if (moving >= 0) {
                    putDown();
                    break;
                }
                editing = it;
                editFrom = page;
                openPage(P_APP, 0);
                break;
            case OPEN:
                Intent launch = launchIntent(activity.getPackageManager(), editing.pkg);
                openOn(editFrom, editing.pkg);   // back from the app on its row
                if (launch != null) start(launch);
                break;
            case MOVE:
                int at = indexOf(editing.pkg);
                openPage(P_APPS, at);
                moving = at;
                hint = "Up and down move it, OK puts it down";
                render();
                break;
            case REMOVE:
                int was = shownApps().indexOf(editing.pkg);
                List<String> left = chosenApps();
                left.remove(editing.pkg);
                saveApps(left);
                if (editFrom == P_ALL) openOn(P_ALL, editing.pkg);
                else openPage(P_APPS, Math.max(0, was));
                break;
            case ALL:
                openPage(P_ALL, 0);
                break;
            case ADD:
                List<String> more = chosenApps();
                List<String> shown = shownApps();
                more.remove(editing.pkg);
                // at the bottom of Home's apps, ahead of any chosen app that is not on the TV now
                more.add(shown.isEmpty() ? 0 : more.indexOf(shown.get(shown.size() - 1)) + 1, editing.pkg);
                saveApps(more);
                openOn(editFrom, editing.pkg);
                break;
            case STORE:
                start(launchIntent(activity.getPackageManager(), STORE_PACKAGE));
                break;
            default:
                break;
        }
    }

    /** Home apps: the app being moved goes one row up or down, and Home's list with it. */
    private void shift(int by) {
        List<String> apps = shownApps();
        int to = moving + by;
        if (to < 0 || to >= apps.size()) return;
        saveApps(InkApps.swap(chosenApps(), apps.get(moving), apps.get(to)));
        Item it = rows.get(moving);
        rows.set(moving, rows.get(to));
        rows.set(to, it);
        moving = to;
        row = to;
        render();
    }

    private void putDown() {
        int at = moving;
        openPage(P_APPS, at);
    }

    private void saveApps(List<String> apps) {
        InkApps.save(activity, apps, dockApps);
        buildItems();
    }

    /** The packages of the app rows on Home now, in order: the chosen apps that are installed and fit. */
    private List<String> shownApps() {
        List<String> out = new ArrayList<>();
        for (Item it : items) if (it.kind == APP) out.add(it.pkg);
        return out;
    }

    /**
     * The Home apps as chosen, in order, with those not shown now (not installed, disabled, or past Home's room): an edit
     * changes this list, so an app that is away for a while is still there when it comes back.
     */
    private List<String> chosenApps() {
        return new ArrayList<>(InkApps.load(activity, dockApps));
    }

    private int indexOf(String pkg) {
        return Math.max(0, shownApps().indexOf(pkg));
    }

    /** Every app the TV can open, by name; not this launcher or Today, which Home already covers. */
    private List<Item> allApps(PackageManager pm) {
        if (allCache != null) return allCache;   // every app's name, read once while the pages are open
        List<Item> out = new ArrayList<>();
        List<String> seen = new ArrayList<>();
        for (String category : new String[] {Intent.CATEGORY_LEANBACK_LAUNCHER, Intent.CATEGORY_LAUNCHER}) {
            for (ResolveInfo r : pm.queryIntentActivities(new Intent(Intent.ACTION_MAIN).addCategory(category), 0)) {
                String pkg = r.activityInfo.packageName;
                if (seen.contains(pkg) || pkg.equals(activity.getPackageName()) || pkg.equals(TODAY)) continue;
                seen.add(pkg);
                out.add(new Item(EDIT, appName(pm, pkg), pkg));
            }
        }
        Collator byName = Collator.getInstance();
        out.sort((a, b) -> byName.compare(a.label, b.label));
        allCache = out;
        return out;
    }

    private static String appName(PackageManager pm, String pkg) {
        try {
            return pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString();
        } catch (PackageManager.NameNotFoundException e) {
            return pkg;
        }
    }

    /**
     * A page: its title, its rows (All apps a page of PAGE_ROWS at a time, the apps on Home marked) and the hint, where
     * Home's list is.
     */
    private void renderPage() {
        int from = page == P_ALL ? row / PAGE_ROWS * PAGE_ROWS : 0;
        int to = page == P_ALL ? Math.min(rows.size(), from + PAGE_ROWS) : rows.size();
        int pages = (rows.size() + PAGE_ROWS - 1) / PAGE_ROWS;
        List<String> onHome = shownApps();
        TextView head = label(page == P_ALL && pages > 1 ? title + "  " + (from / PAGE_ROWS + 1) + "/" + pages : title);
        head.setTextColor(muted);
        head.setPadding(px(24), 0, px(24), 0);
        list.addView(head, wrap(0));
        for (int i = from; i < to; i++) {
            Item it = rows.get(i);
            // Home apps: a gap between the apps and the row under them, as on Home
            boolean gap = i > from && it.kind != EDIT && rows.get(i - 1).kind == EDIT;
            if (gap) list.addView(new View(activity), new LinearLayout.LayoutParams(1, px(28)));
            TextView t = text(it.kind == NOTE ? 30 : 42, false);
            boolean on = i == row && it.kind != NOTE;
            if (i == moving) {
                t.setText(it.label + "   ↑↓");
            } else if (page == P_ALL && onHome.contains(it.pkg)) {
                SpannableString s = new SpannableString(it.label + "   on Home");
                s.setSpan(new ForegroundColorSpan(on ? Color.argb(170, Color.red(paper), Color.green(paper), Color.blue(paper)) : muted),
                        it.label.length(), s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                s.setSpan(new AbsoluteSizeSpan(px(30)), it.label.length(), s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                t.setText(s);
            } else {
                t.setText(it.label);
            }
            t.setPadding(px(24), px(12), px(24), px(12));
            t.setTextColor(on ? paper : it.kind == NOTE ? muted : ink);
            if (on) t.setBackgroundColor(ink);
            list.addView(t, wrap(i == from ? 28 : 4));
        }
        if (hint != null) {
            TextView h = text(26, false, hint, muted);
            h.setPadding(px(24), 0, px(24), 0);
            list.addView(h, wrap(36));
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
        // on Home a long app name ends in … before the middle column, where Calendar's and Tasks' previews open
        int width = px(page == P_HOME ? MIDDLE_LEFT - 48 - 216 : 820);
        if (list.getLayoutParams().width != width) {
            list.getLayoutParams().width = width;
            list.requestLayout();
        }
        if (page != P_HOME) {
            renderPage();
            showPreview();   // the song's block, over the page too
            return;
        }
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
     * The preview follows the selection, swapping at once: Calendar's, Tasks', or with the Spotify row the song's in
     * place of the block at the top right. A song playing keeps the block on every other row and on the settings pages;
     * with nothing playing, a streaming app's row shows its last show watched there instead. Calendar and Tasks always
     * open in the middle column, level with the first row (and so with the block), so they stay put whether a song plays
     * or not and never stack under it.
     */
    private void showPreview() {
        boolean playing = songShown();
        if (page != P_HOME) {
            // a settings page: no previews, but the song stays
            songBlock.show(playing ? song : null, ink, muted, paper, night);
            placeBlock();
            return;
        }
        Item it = items.get(selected);
        int want = it.kind == CALENDAR || it.kind == TASKS ? it.kind : songRow(it) ? SONG : NONE;
        boolean middle = want == CALENDAR || want == TASKS;
        // the row's last show takes the block's place only while no song does; the song's preview replaces it on its row
        Watched last = playing ? null : watchedOn(it);
        if (last != null) songBlock.show(last, ink, muted, paper, night);
        else songBlock.show(playing && want != SONG ? song : null, ink, muted, paper, night);
        placeBlock();
        // the song's cover level with the first row too, like the block's, the kingfisher standing in the air above it
        int top = middle ? firstRowTop : firstRowTop - px(SONG_COVER * SongBird.OVER);
        int width = px(SONG_WIDTH);
        if (middle) {
            // the middle column, ending 48 px before the block (at its widest, the right-hand column)
            int blockLeft = activity.getResources().getDisplayMetrics().widthPixels - px(240);
            if (songBlock.getVisibility() == View.VISIBLE) {
                songBlock.measure(View.MeasureSpec.UNSPECIFIED, View.MeasureSpec.UNSPECIFIED);
                blockLeft -= songBlock.getMeasuredWidth();
            }
            width = Math.min(px(MIDDLE_WIDTH + 48), blockLeft - px(24) - px(MIDDLE_LEFT - 24));
        }
        if (want == shownPreview && top == shownTop && middle == shownMiddle && width == shownWidth) return;
        shownPreview = want;
        shownTop = top;
        shownMiddle = middle;
        shownWidth = width;
        FrameLayout.LayoutParams pp = (FrameLayout.LayoutParams) preview.getLayoutParams();
        pp.gravity = Gravity.TOP | (middle ? Gravity.START : Gravity.END);
        // the column's own padding is 24 a side, so its text starts at MIDDLE_LEFT
        pp.leftMargin = middle ? px(MIDDLE_LEFT - 24) : 0;
        pp.rightMargin = middle ? 0 : px(216);
        pp.width = width;
        pp.topMargin = top;
        pp.height = px(600);   // either way it ends above the clock
        preview.setLayoutParams(pp);
        fillPreview();
    }

    /** The block's cover level with the first row; the kingfisher and its notes stand in the air above it. */
    private void placeBlock() {
        FrameLayout.LayoutParams sp = (FrameLayout.LayoutParams) songBlock.getLayoutParams();
        if (sp.topMargin != firstRowTop - songBlock.overhang()) {
            sp.topMargin = firstRowTop - songBlock.overhang();
            songBlock.setLayoutParams(sp);
        }
    }

    /** Puts the page for the selection shown now on screen. */
    private void fillPreview() {
        preview.removeAllViews();
        main.removeCallbacks(tick);
        progress = null;
        elapsed = null;
        songBird = null;
        previousMark = playMark = nextMark = null;
        if (shownPreview == CALENDAR) preview.addView(calendarPreview());
        else if (shownPreview == TASKS) preview.addView(tasksPreview());
        else if (shownPreview == SONG) preview.addView(songPreview(items.get(selected).label));
    }

    /**
     * The song, larger, laid out like the block: the cover in shades of ink with the kingfisher on it, and beside it NOW
     * PLAYING over the title, the artist, the playlist it plays from (or its album) and the three marks; then the progress
     * line, with the times at its ends and what a short OK does between them.
     */
    private View songPreview(String app) {
        LinearLayout col = column();
        LinearLayout row = row();
        // the bird and its notes stand in the row's padding above the cover, the notes reaching over the words
        row.setPadding(0, px(SONG_COVER * SongBird.OVER), 0, 0);
        row.setClipToPadding(false);
        row.setClipChildren(false);
        FrameLayout perch = new FrameLayout(activity);
        perch.setClipChildren(false);
        CoverView cover = new CoverView(activity);
        cover.set(song.cover, ink, paper, night);
        perch.addView(cover, new FrameLayout.LayoutParams(px(SONG_COVER), px(SONG_COVER)));
        songBird = new SongBird(activity, scale);
        songBird.setBird(kingfisher);
        songBird.set(song.playing, ink, paper);
        perch.addView(songBird, new FrameLayout.LayoutParams(px(SONG_COVER), px(SONG_COVER)));
        row.addView(perch, new LinearLayout.LayoutParams(px(SONG_COVER), px(SONG_COVER)));
        LinearLayout words = new LinearLayout(activity);
        words.setOrientation(LinearLayout.VERTICAL);
        TextView head = label(song.playing ? "NOW PLAYING" : "PAUSED");
        head.setTextColor(muted);
        words.addView(head, wrap(0));
        TextView title = text(46, true, song.title, ink);
        title.setSingleLine(false);
        title.setMaxLines(2);   // a long title takes two lines, then …
        words.addView(title, wrap(12));
        words.addView(text(30, false, song.artist, ink), wrap(10));
        // the playlist, or the album when Spotify names none; a single's album has the song's name: said once is enough
        boolean list = song.fromPlaylist();
        if (list || !song.album.isEmpty() && !song.album.equals(song.title)) {
            LinearLayout from = row();
            from.addView(new SourceMark(list), new LinearLayout.LayoutParams(px(24), px(24)));
            LinearLayout.LayoutParams fp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            fp.leftMargin = px(10);
            from.addView(text(24, false, list ? song.playlist : song.album, muted), fp);
            add(words, from, 8);
        }
        words.addView(transport(), wrap(20));
        LinearLayout.LayoutParams wp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        wp.leftMargin = px(30);
        row.addView(words, wp);
        add(col, row, 0);
        if (song.duration > 0) {
            progress = new ProgressLine();
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, px(5));
            lp.topMargin = px(28);
            col.addView(progress, lp);
        }
        LinearLayout times = row();
        TextView open = text(24, false, "OK opens " + app, muted);
        open.setGravity(Gravity.CENTER);
        if (progress != null) {
            elapsed = text(24, false, "", muted);
            times.addView(elapsed, wrap(0));
            times.addView(open, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            times.addView(text(24, false, Playing.time(song.duration), muted), wrap(0));
            onTick();
        } else {
            times.addView(open, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        }
        add(col, times, 10);
        return col;
    }

    /** The remote's ring as three marks, Left · hold OK · Right, each with its key under it. */
    private View transport() {
        LinearLayout row = row();
        row.setGravity(Gravity.TOP);
        previousMark = mark(row, "◀", 32);
        playMark = mark(row, "hold OK", 32);
        nextMark = mark(row, "▶", 0);
        marks();
        return row;
    }

    private Mark mark(LinearLayout row, String key, float gap) {
        LinearLayout col = new LinearLayout(activity);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER_HORIZONTAL);
        Mark m = new Mark();
        col.addView(m, new LinearLayout.LayoutParams(px(56), px(56)));
        col.addView(text(24, false, key, muted), wrap(4));
        LinearLayout.LayoutParams lp = wrap(0);
        lp.rightMargin = px(gap);
        row.addView(col, lp);
        return m;
    }

    /** The three marks, as the keys and Spotify stand now: inked while a key works, faint where Spotify won't skip. */
    private void marks() {
        if (playMark == null || song == null) return;
        previousMark.set(Mark.PREVIOUS, skipping == Playing.SKIP_PREVIOUS, !song.canSkip(Playing.SKIP_PREVIOUS));
        playMark.set(song.playing ? Mark.PAUSE : Mark.PLAY, okHeld, false);
        nextMark.set(Mark.NEXT, skipping == Playing.SKIP_NEXT, !song.canSkip(Playing.SKIP_NEXT));
    }

    /** The progress line and the time so far, again as each second of the song comes while it plays. */
    private void onTick() {
        main.removeCallbacks(tick);
        if (progress == null || song == null) return;
        long at = song.positionAt(SystemClock.elapsedRealtime());
        progress.set(song.duration > 0 ? at / (float) song.duration : 0);
        elapsed.setText(Playing.time(at));
        // just past the next whole second, so the time steps on with the song rather than up to a second behind it
        if (song.playing && resumed) main.postDelayed(tick, TICK_MS - at % TICK_MS + 20);
    }

    private View calendarPreview() {
        LinearLayout col = column();
        col.addView(label("TODAY", 24));
        JSONArray events = agenda == null ? null : agenda.optJSONArray("events");
        if (agenda == null) {
            add(col, status(waiting("your day", "Calendar")), 10);
        } else if (events == null || events.length() == 0) {
            add(col, text(32, false, "Nothing on the calendar", muted), 10);
        } else {
            // what is still to come: timed events not over yet, the day's all-day ones in the rows they leave (above them)
            long now = System.currentTimeMillis();
            List<JSONObject> allDay = new ArrayList<>();
            List<JSONObject> coming = new ArrayList<>();
            for (int i = 0; i < events.length(); i++) {
                JSONObject e = events.optJSONObject(i);
                if (e == null) continue;
                if (e.optBoolean("allDay")) allDay.add(e);
                else if (e.optLong("endMs") > now) coming.add(e);
            }
            int timed = Math.min(coming.size(), allDay.isEmpty() ? PREVIEW_EVENTS : PREVIEW_EVENTS - 1);
            int whole = Math.min(allDay.size(), PREVIEW_EVENTS - timed);
            if (whole + timed == 0) add(col, text(32, false, "Nothing more today", muted), 10);
            for (int i = 0; i < whole; i++) add(col, eventLine(allDay.get(i), false), 20);
            boolean nextShown = false;
            for (int i = 0; i < timed; i++) {
                JSONObject e = coming.get(i);
                // the next one in bold; one carried over from an earlier day (a conference) never is
                boolean next = !nextShown && !e.optBoolean("carried");
                nextShown |= next;
                add(col, eventLine(e, next), 20);
            }
            int more = allDay.size() - whole + coming.size() - timed;
            if (more > 0) add(col, text(24, false, "+" + more + " more", muted), 16);
        }
        JSONObject nextDay = agenda == null || events == null || events.length() > 0 ? null : agenda.optJSONObject("nextDay");
        JSONArray later = nextDay == null ? null : nextDay.optJSONArray("events");
        JSONArray tomorrow = agenda == null ? null : agenda.optJSONArray("tomorrow");
        if (later != null && later.length() > 0) {
            // nothing today: the next day that has something, laid out like today
            add(col, label(nextDay.optString("label"), 24), 44);
            for (int i = 0; i < Math.min(PREVIEW_EVENTS, later.length()); i++) {
                JSONObject e = later.optJSONObject(i);
                if (e != null) add(col, eventLine(e, false), 20);
            }
        } else if (tomorrow != null && tomorrow.length() > 0) {
            JSONObject t = tomorrow.optJSONObject(0);
            add(col, text(24, false, "Tomorrow · " + t.optString("time") + " " + t.optString("title"), muted), 28);
        }
        asOf(col);
        return col;
    }

    /** One event: its time ("9:00", "All day", "–17:00" for one carried over) and its title. */
    private View eventLine(JSONObject e, boolean isBold) {
        LinearLayout row = row();
        row.addView(text(32, isBold, e.optString("time"), ink), new LinearLayout.LayoutParams(px(150), ViewGroup.LayoutParams.WRAP_CONTENT));
        row.addView(text(32, isBold, e.optString("title"), ink), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        return row;
    }

    /**
     * What a preview with nothing of today's says: being fetched, or why not (no network, the script's key or error,
     * Today signed with another key), so a preview that stays empty says what to do.
     */
    private String waiting(String what, String screen) {
        switch (agendaProblem) {
            case OTHER_KEY:
                return "Today is signed with another key: build both apps on the same computer";
            case UNREADABLE:
                return "Can't read Today: install both apps from the same build";
            case NETWORK:
                return "No connection yet: trying again";
            case KEY:
                return "The script refused Today's key: open " + screen + " for more";
            case SCRIPT:
                return "The script answered with an error: open " + screen + " for more";
            default:
                return agendaStale ? "Fetching today's agenda…" : "Fetching " + what + "…";
        }
    }

    /** A message that may take more than one line. */
    private TextView status(String s) {
        TextView t = text(32, false, s, muted);
        t.setSingleLine(false);
        t.setMaxLines(3);
        return t;
    }

    /** Under a preview whose answer is over an hour old or whose last fetch failed: from when it is, and why. */
    private void asOf(LinearLayout col) {
        if (agenda == null || agendaProblem == 0 && System.currentTimeMillis() - agendaUpdated < HOUR_MS) return;
        String why = agendaProblem == NETWORK ? " · offline" : agendaProblem == KEY ? " · key refused"
                : agendaProblem == SCRIPT ? " · script error" : "";
        LocalTime at = Instant.ofEpochMilli(agendaUpdated).atZone(ZoneId.systemDefault()).toLocalTime();
        add(col, text(24, false, "as of " + clockText(at) + why, muted), 28);
    }

    private View tasksPreview() {
        LinearLayout col = column();
        JSONArray tasks = agenda == null ? null : agenda.optJSONArray("tasks");
        int open = tasks == null ? 0 : tasks.length();
        col.addView(label(agenda == null ? "TASKS" : open + " OPEN", 24));
        if (agenda == null) {
            add(col, status(waiting("your tasks", "Tasks")), 10);
        } else if (open == 0) {
            add(col, text(32, false, agenda.optBoolean("tasksFailed") ? "Couldn't read Google Tasks" : "No open tasks", muted), 10);
        }
        for (int i = 0; i < Math.min(3, open); i++) {
            JSONObject t = tasks.optJSONObject(i);
            LinearLayout row = row();
            row.addView(new Box(), new LinearLayout.LayoutParams(px(24), px(24)));
            row.addView(new View(activity), new LinearLayout.LayoutParams(px(22), 1));
            row.addView(text(32, false, t.optString("title"), ink), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            String due = t.optString("due");
            if (!due.isEmpty()) {
                LinearLayout.LayoutParams dp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                dp.leftMargin = px(16);   // a long title ellipsizes before the due day instead of running into it
                row.addView(text(24, "overdue".equals(due), due, "overdue".equals(due) ? ink : muted), dp);
            }
            add(col, row, 20);
        }
        JSONArray done = agenda == null ? null : agenda.optJSONArray("doneToday");
        if (done != null && done.length() > 0) add(col, text(24, false, done.length() + " done today", muted), 28);
        asOf(col);
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
        return label(s, 24);
    }

    /** Calendar's and Tasks' previews take a smaller one, to sit beside the song's block in the middle column. */
    private TextView label(String s, float size) {
        TextView t = text(size, true, s, ink);
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

    /** Before the playlist or the album under the artist: three lines and a note, or a record. */
    private final class SourceMark extends View {
        private final boolean playlist;
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);

        SourceMark(boolean playlist) {
            super(activity);
            this.playlist = playlist;
        }

        @Override
        protected void onDraw(Canvas canvas) {
            float u = getWidth() / 24f;
            paint.setColor(muted);
            paint.setStrokeWidth(2 * u);
            paint.setStrokeCap(Paint.Cap.ROUND);
            paint.setStyle(Paint.Style.STROKE);
            if (playlist) {
                canvas.drawLine(3 * u, 6 * u, 15 * u, 6 * u, paint);
                canvas.drawLine(3 * u, 11 * u, 15 * u, 11 * u, paint);
                canvas.drawLine(3 * u, 16 * u, 10 * u, 16 * u, paint);
                canvas.drawLine(18 * u, 17 * u, 18 * u, 8 * u, paint);
                canvas.drawLine(18 * u, 8 * u, 22 * u, 7 * u, paint);
                paint.setStyle(Paint.Style.FILL);
                canvas.drawCircle(16 * u, 17 * u, 2.2f * u, paint);
            } else {
                canvas.drawCircle(12 * u, 12 * u, 9 * u, paint);
                paint.setStyle(Paint.Style.FILL);
                canvas.drawCircle(12 * u, 12 * u, 2.5f * u, paint);
            }
        }
    }

    /**
     * One of the song's marks, drawn on a 24-unit grid inside a 10-unit margin: inked (paper on an ink square) while its
     * key is held or Spotify catches up, faded where Spotify won't skip.
     */
    private final class Mark extends View {
        static final int PREVIOUS = 0;
        static final int PAUSE = 1;
        static final int PLAY = 2;
        static final int NEXT = 3;
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path path = new Path();
        private int shape;
        private boolean inked;
        private boolean faint;

        Mark() {
            super(activity);
        }

        void set(int shape, boolean inked, boolean faint) {
            this.shape = shape;
            this.inked = inked;
            this.faint = faint;
            invalidate();
        }

        @Override
        protected void onDraw(Canvas canvas) {
            if (inked) canvas.drawColor(ink);
            paint.setColor(inked ? paper : faint ? Color.argb(70, Color.red(ink), Color.green(ink), Color.blue(ink)) : ink);
            float margin = getWidth() * 10 / 64f;
            float unit = (getWidth() - 2 * margin) / 24f;
            canvas.save();
            canvas.translate(margin, margin);
            canvas.scale(unit, unit);
            path.reset();
            switch (shape) {
                case PREVIOUS:
                    canvas.drawRect(5, 5, 7.6f, 19, paint);
                    triangle(19, 5, 19, 19, 8.5f, 12);
                    break;
                case NEXT:
                    canvas.drawRect(16.4f, 5, 19, 19, paint);
                    triangle(5, 5, 5, 19, 15.5f, 12);
                    break;
                case PAUSE:
                    canvas.drawRect(6, 5, 10, 19, paint);
                    canvas.drawRect(14, 5, 18, 19, paint);
                    break;
                default:
                    triangle(7, 5, 7, 19, 19, 12);
            }
            canvas.drawPath(path, paint);
            canvas.restore();
        }

        private void triangle(float x1, float y1, float x2, float y2, float x3, float y3) {
            path.moveTo(x1, y1);
            path.lineTo(x2, y2);
            path.lineTo(x3, y3);
            path.close();
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
