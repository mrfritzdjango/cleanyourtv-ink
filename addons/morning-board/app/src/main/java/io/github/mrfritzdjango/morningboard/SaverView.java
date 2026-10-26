package io.github.mrfritzdjango.morningboard;

import io.github.mrfritzdjango.ink.Animals;
import io.github.mrfritzdjango.ink.Playing;
import io.github.mrfritzdjango.ink.ShowView;
import io.github.mrfritzdjango.ink.Shows;
import io.github.mrfritzdjango.ink.SongBlock;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Resources;
import android.database.ContentObserver;
import android.graphics.Typeface;
import android.os.Handler;
import android.os.Looper;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.StyleSpan;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * The e-ink screensaver: an animal in ink (outline, halftone dots, solid marks) beside the Home's big clock. The animal
 * holds still, then every saver_still_seconds goes out on its outing (its own way of moving, from moves.bin, played by
 * ShowView) and comes back. A new animal every saver_change_minutes, night ink from night_start to night_end, and the
 * whole picture nudged a few pixels each minute so nothing burns in. While Spotify plays, the song sits at the top right
 * (NowPlaying, the same block as on Home). Used by AnimalDream and SaverActivity.
 */
final class SaverView extends FrameLayout {
    private static final float DESIGN_WIDTH = 1920f;
    /** The animal's box at home, design pixels: its centre and size. */
    private static final float HOME_X = 700;
    private static final float HOME_Y = 480;
    private static final float HOME_W = 1000;
    private static final float HOME_H = 740;
    /** Design-pixel offsets, one per minute, round and round. */
    private static final int[][] NUDGE = {{0, 0}, {10, -6}, {-8, 8}, {12, 6}, {-10, -8}, {6, 10}};
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("EEE d MMM", Locale.ENGLISH);

    private final Handler main = new Handler(Looper.getMainLooper());
    private final Runnable minute = () -> update(true);
    private final Runnable outing = this::goOut;
    /** Made each time the view goes on screen and shut down when it leaves: the same view can come back, and a shut pool refuses work. */
    private ExecutorService io;
    /** Read off the main thread when the view is attached (animals.json is large); empty until then. */
    private List<Animals.Animal> animals = Collections.emptyList();
    private Shows shows;
    /** pick() before the animals were read: done once they are. */
    private String picked;
    private final float scale;
    private final Typeface regular;
    private final FrameLayout stage;
    private final ShowView art;
    private final TextView caption;
    private final TextView hint;
    private final TextView clock;
    private final TextView date;
    private final TextView next;
    private final SongBlock song;
    private final ContentObserver songChanged = new ContentObserver(main) {
        @Override
        public void onChange(boolean selfChange) {
            showSong();
        }
    };
    private boolean night;
    private boolean drawn;
    private int shown = -2;
    /** Animals skipped with left and right; the rotation carries on from there. */
    private int offset;
    private int nudge;
    private int paper = Ink.PAPER;
    private int ink = Ink.INK;
    private int muted = Ink.MUTED;
    /** The animal shown now: its outing and its drawing, once they are ready. */
    private Animals.Animal current;
    private Shows.Show currentOuting;
    private ShowView.Drawing currentDrawing;
    /** Counts animal changes, so a drawing that finishes after the next change is dropped. */
    private int generation;
    /** pick(): the first outing in two seconds rather than after the usual wait. */
    private boolean soon;

    SaverView(Context context) {
        super(context);
        Resources res = context.getResources();
        scale = res.getDisplayMetrics().widthPixels / DESIGN_WIDTH;
        regular = res.getFont(R.font.atkinson_regular);
        Typeface bold = res.getFont(R.font.atkinson_bold);

        stage = new FrameLayout(context);
        addView(stage, new LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        art = new ShowView(context, bold);   // the whole screen: an outing goes everywhere
        art.setShakeTarget(this);
        stage.addView(art, new LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        caption = text(26);
        LayoutParams cp = new LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM | Gravity.START);
        cp.leftMargin = px(240);
        cp.bottomMargin = px(120);
        addView(caption, cp);   // the name and the hint stay still; only the stage is nudged against burn-in
        hint = text(22);
        hint.setText(R.string.saver_hint);
        LayoutParams hp = new LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM | Gravity.START);
        hp.leftMargin = px(240);
        hp.bottomMargin = px(80);
        addView(hint, hp);

        LinearLayout block = new LinearLayout(context);
        block.setOrientation(LinearLayout.VERTICAL);
        block.setGravity(Gravity.END);
        clock = text(180);
        clock.setLetterSpacing(-0.02f);
        date = text(34);
        next = text(28);
        block.addView(clock, below(0));   // wrap, not the vertical default of match_parent, or the date's width clips it
        block.addView(date, below(10));
        block.addView(next, below(14));
        LayoutParams bp = new LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM | Gravity.END);
        bp.rightMargin = px(240);
        bp.bottomMargin = px(120);
        stage.addView(block, bp);

        song = new SongBlock(context, regular, bold, scale);
        LayoutParams sp = new LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP | Gravity.END);
        sp.rightMargin = px(240);
        sp.topMargin = px(116);   // where Home has it: level with the first row of its full list
        stage.addView(song, sp);
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        io = Executors.newSingleThreadExecutor();
        update(true);   // the clock at once; the animals follow
        Context context = getContext();
        context.getContentResolver().registerContentObserver(NowPlaying.URI, false, songChanged);
        ExecutorService loading = io;
        loading.execute(() -> {
            List<Animals.Animal> list = Animals.load(context);
            Shows index = Shows.open(context.getAssets());
            main.post(() -> {
                // closed while the animals loaded (any key closes SaverActivity): nothing more to draw
                if (io != loading) return;
                animals = list;
                shows = index;
                update(false);
                if (picked != null) pick(picked);
            });
        });
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        getContext().getContentResolver().unregisterContentObserver(songChanged);
        main.removeCallbacksAndMessages(null);
        io.shutdownNow();
        io = null;
        shown = -2;   // back on screen, the animal is drawn again
    }

    /** Shows this animal now and sends it out after two seconds (SaverActivity --es animal <id>, to try a show). */
    void pick(String id) {
        picked = id;
        if (animals.isEmpty() || shown < 0) return;
        picked = null;
        for (int i = 0; i < animals.size(); i++) {
            if (animals.get(i).id.equals(id)) {
                offset += i - shown;
                soon = true;
                update(false);
                return;
            }
        }
    }

    /** Left and right on the remote: the previous or next animal. */
    void step(int by) {
        if (animals.isEmpty()) return;
        offset += by;
        update(false);   // a new animal only: nothing else moves
    }

    /** onMinute: also nudge the picture a few pixels, once a minute, so nothing burns in. */
    private void update(boolean onMinute) {
        main.removeCallbacks(minute);
        Resources res = getResources();
        long now = System.currentTimeMillis();
        boolean n = Ink.isNight(res);
        int every = Math.max(1, res.getInteger(R.integer.saver_change_minutes));
        long localMinutes = (now + TimeZone.getDefault().getOffset(now)) / 60_000L;
        int index = animals.isEmpty() ? -1 : (int) Math.floorMod(localMinutes / every + offset, (long) animals.size());
        if (n != night || !drawn) {
            night = n;
            paper = n ? Ink.NIGHT_PAPER : Ink.PAPER;
            ink = n ? Ink.NIGHT_INK : Ink.INK;
            muted = n ? Ink.NIGHT_MUTED : Ink.MUTED;
            setBackground(Ink.paper(res, n));
            clock.setTextColor(ink);
            date.setTextColor(ink);
            next.setTextColor(muted);
            caption.setTextColor(muted);
            hint.setTextColor(muted);
            art.colours(ink, paper);
            if (index == shown) prepare(current);   // the same animal, redrawn in the new ink
        }
        if (index != shown) {
            shown = index;
            Animals.Animal a = index < 0 ? null : animals.get(index);
            prepare(a);   // the next animal simply replaces this one
            caption.setText(a == null ? "" : caption(a));
        }
        clock.setText(Times.clock(LocalTime.now()));
        date.setText(DATE.format(LocalDate.now()));
        next.setText(nextEvent(now));
        showSong();   // also takes away a song paused for ten minutes
        if (onMinute) {
            nudge = (nudge + 1) % NUDGE.length;
            stage.setTranslationX(px(NUDGE[nudge][0]));
            stage.setTranslationY(px(NUDGE[nudge][1]));
        }
        drawn = true;
        main.postDelayed(minute, 60_000 - now % 60_000 + 50);
    }

    /** The song NowPlaying follows (Today's own, no provider needed), in the ink of the moment; nothing when none. */
    private void showSong() {
        Playing p = NowPlaying.current();
        song.show(p != null && p.shownAt(System.currentTimeMillis()) ? p : null, ink, muted, paper, night);
    }

    /** "Malayan tapir  ·  Tenuk": the English name and what it is called locally (the Latin name, in italics, if there is none). */
    private static CharSequence caption(Animals.Animal a) {
        SpannableStringBuilder s = new SpannableStringBuilder(a.name);
        if (!a.malay.isEmpty()) {
            s.append("  ·  ").append(a.malay);
        } else if (!a.latin.isEmpty()) {
            s.append("  ·  ");
            int from = s.length();
            s.append(a.latin);
            s.setSpan(new StyleSpan(Typeface.ITALIC), from, s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        }
        return s;
    }

    /** The next event from the board's last answer, if it was fetched today: today's next, or tomorrow's first at night. */
    private String nextEvent(long now) {
        SharedPreferences prefs = getContext().getSharedPreferences("board", Context.MODE_PRIVATE);
        String body = prefs.getString("body", null);
        long updated = prefs.getLong("updated", 0);
        if (body == null || !Instant.ofEpochMilli(updated).atZone(ZoneId.systemDefault()).toLocalDate().equals(LocalDate.now())) return "";
        try {
            Agenda a = Agenda.parse(body);
            int i = a.next(now);
            if (i >= 0) return "Next · " + a.events.get(i).time + " " + a.events.get(i).title;
            if (night && !a.tomorrow.isEmpty()) return "Tomorrow · " + a.tomorrow.get(0).time + " " + a.tomorrow.get(0).title;
        } catch (Exception e) {
            // no line rather than a wrong one
        }
        return "";
    }

    private int px(float design) {
        return Math.round(design * scale);
    }

    private TextView text(float size) {
        TextView t = new TextView(getContext());
        t.setTypeface(regular);
        t.setTextSize(TypedValue.COMPLEX_UNIT_PX, size * scale);
        t.setIncludeFontPadding(false);
        t.setSingleLine(true);
        return t;
    }

    private LinearLayout.LayoutParams below(float gap) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.topMargin = px(gap);
        return p;
    }

    /**
     * Gets the animal ready off the main thread: its outing and its drawing at the outing's size. It shows still at
     * home, and goes out after saver_still_seconds. An animal without a show is drawn still in its box.
     */
    private void prepare(Animals.Animal a) {
        int gen = ++generation;
        main.removeCallbacks(outing);
        art.stop();
        current = a;
        currentOuting = null;
        currentDrawing = null;
        art.still(null, null);
        if (a == null) return;
        int inkNow = ink, paperNow = paper, width = getResources().getDisplayMetrics().widthPixels;
        Shows index = shows;
        if (io == null) return;   // off screen: it is drawn when the view comes back
        io.execute(() -> {
            float k = width / DESIGN_WIDTH;
            Shows.Show s = index != null ? index.load(a.id, false) : null;
            if (s == null) s = ShowView.home(a, HOME_X, HOME_Y, Math.min(HOME_W / a.width, HOME_H / a.height));
            int[] props = index != null ? index.props(a.id) : new int[0];
            ShowView.Drawing drawing = ShowView.draw(a, props, s.fit * k, inkNow, paperNow, 12 * k);
            Shows.Show ready = s;
            main.post(() -> {
                if (gen != generation) return;
                currentOuting = ready;
                currentDrawing = drawing;
                art.still(ready, drawing);
                main.postDelayed(outing, soon ? 2000 : stillMillis());
                soon = false;
            });
        });
    }

    /** The outing; then still again, and out again later. */
    private void goOut() {
        if (currentOuting == null || currentOuting.frames.length < 2) return;
        art.play(currentOuting, currentDrawing, false, 1, () -> main.postDelayed(outing, stillMillis()));
    }

    private long stillMillis() {
        return Math.max(5, getResources().getInteger(R.integer.saver_still_seconds)) * 1000L;
    }
}
