package io.github.mrfritzdjango.morningboard;

import io.github.mrfritzdjango.ink.Playing;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;

/**
 * The last agenda, read-only, for the launcher's e-ink Home (its Calendar and Tasks previews; Home has no network), and
 * at .../now the song playing (NowPlaying). Guarded by a signature permission, so only an app signed with the same key
 * can read it.
 */
public final class AgendaProvider extends ContentProvider {
    static final String AUTHORITY = "io.github.mrfritzdjango.morningboard.agenda";
    static final Uri URI = Uri.parse("content://" + AUTHORITY + "/today");

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        if ("now".equals(uri.getLastPathSegment())) {
            // .../now: the song NowPlaying follows, one row or none
            MatrixCursor now = new MatrixCursor(Playing.COLUMNS);
            Playing p = NowPlaying.current();
            if (p != null) now.addRow(p.row());
            now.setNotificationUri(getContext().getContentResolver(), NowPlaying.URI);
            return now;
        }
        MatrixCursor cursor = new MatrixCursor(new String[] {"body", "updated"});
        SharedPreferences prefs = Store.prefs(getContext());
        String body = prefs.getString("body", null);
        if (body != null) cursor.addRow(new Object[] {body, prefs.getLong("updated", 0)});
        cursor.setNotificationUri(getContext().getContentResolver(), URI);
        return cursor;
    }

    @Override
    public String getType(Uri uri) {
        return "vnd.android.cursor.item/vnd.morningboard.agenda";
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }
}
