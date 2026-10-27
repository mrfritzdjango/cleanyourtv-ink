// Morning Board: today's events and open tasks for the TV, as JSON.
//
// 1. script.google.com > New project, paste this file and appsscript.json (Project Settings > show the manifest).
// 2. Run setup() once and allow access to Calendar and Tasks. The log shows the key the TV needs.
// 3. Deploy > New deployment > Web app: Execute as Me, Who has access: Anyone. Copy the /exec URL.
//
// Anyone with the URL and the key can read today's agenda and tick its tasks off (OK on a task in Today does that),
// so keep both private, like a secret calendar link.

function setup() {
  const props = PropertiesService.getScriptProperties();
  let key = key_();
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('KEY', key);
  }
  console.log('key=' + key);
  console.log(JSON.stringify(agenda_(), null, 2));
}

// The key: from Script properties (setup), or from a Key.gs file with const BOARD_KEY = '...' pushed with clasp.
function key_() {
  const stored = PropertiesService.getScriptProperties().getProperty('KEY');
  if (stored) return stored;
  return typeof BOARD_KEY === 'string' && BOARD_KEY ? BOARD_KEY : null;
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const key = key_();
  if (!key || p.key !== key) return json_({ ok: false, error: 'key' });
  try {
    if (p.action === 'done') return json_(markDone_(p.list, p.task));
    return json_(agenda_());
  } catch (err) {
    // Uncaught, this would reach the TV as an HTML error page; as JSON, Today can say the script needs looking at
    // (authorisation expired or revoked, a quota).
    return json_({ ok: false, error: 'script', message: String(err).slice(0, 200) });
  }
}

// One part that fails (a Tasks quota, a list deleted meanwhile) leaves the rest of the day; fallback in its place.
function tryOr_(part, fallback) {
  try {
    return part();
  } catch (err) {
    console.warn(err);
    return fallback;
  }
}

// The TV shows a screenful; past this many open tasks the answer only grows.
const MAX_TASKS = 50;

function agenda_() {
  // Your Google Calendar's own time zone (Calendar settings), so nothing here needs setting per person.
  const tz = CalendarApp.getTimeZone();
  const now = new Date();
  const today0 = dayStart_(now, tz);
  const tomorrow0 = nextDayStart_(today0, tz);
  const after0 = nextDayStart_(tomorrow0, tz);
  const day = (d) => Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  const events = events_(today0, tomorrow0, tz);
  const lists = tryOr_(lists_, null);
  const tasks = lists && tryOr_(() => openTasks_(lists, day(now), day(tomorrow0)), null);
  const done = lists && tryOr_(() => doneTasks_(lists, today0), null);
  return {
    ok: true,
    timeZone: tz,
    generated: Utilities.formatDate(now, tz, "yyyy-MM-dd'T'HH:mm:ssXXX"),
    todayLong: Utilities.formatDate(now, tz, 'EEEE d MMMM'),
    todayShort: Utilities.formatDate(now, tz, 'EEE d MMM'),
    tomorrowShort: Utilities.formatDate(tomorrow0, tz, 'EEE d MMM'),
    events: events,
    tomorrow: events_(tomorrow0, after0, tz),
    nextDay: events.length ? null : tryOr_(() => nextDay_(tomorrow0, tz), null),
    tasks: (tasks || []).slice(0, MAX_TASKS),
    doneToday: done || [],
    // Tasks could not be read this time: the TV says so rather than "No open tasks"
    tasksFailed: !tasks || !done
  };
}

function events_(from, to, tz) {
  const seen = {};
  const out = [];
  CalendarApp.getAllCalendars()
    .filter((c) => c.isSelected() && !c.isHidden())
    .forEach((c) => c.getEvents(from, to).forEach((ev) => {
      if (ev.getMyStatus() === CalendarApp.GuestStatus.NO) return;
      const start = ev.getStartTime();
      const id = ev.getTitle() + '|' + start.getTime();
      if (seen[id]) return;   // the same event on two calendars
      seen[id] = true;
      const allDay = ev.isAllDayEvent();
      const end = ev.getEndTime();
      // A timed event that began on an earlier day (a conference, a night flight): until when it runs this day, or all
      // of it. It is never this day's "next".
      const carried = !allDay && start < from;
      out.push({
        title: ev.getTitle() || '(no title)',
        where: (ev.getLocation() || '').split(',')[0].slice(0, 32),
        allDay: allDay,
        carried: carried,
        time: allDay ? 'All day'
          : carried ? (end < to ? '–' + Utilities.formatDate(end, tz, 'H:mm') : 'All day')
            : Utilities.formatDate(start, tz, 'H:mm'),
        startMs: start.getTime(),
        endMs: end.getTime()
      });
    }));
  out.sort((a, b) => (b.allDay - a.allDay) || (a.startMs - b.startMs));
  return out;
}

// Midnight at the start of d's day, in the script's time zone.
function dayStart_(d, tz) {
  return new Date(Utilities.formatDate(d, tz, "yyyy-MM-dd'T'00:00:00XXX"));
}

// The midnight after day0: 36 hours on lands inside the next day even when the clocks change (a 23 or 25 hour day).
function nextDayStart_(day0, tz) {
  return dayStart_(new Date(day0.getTime() + 36 * 3600 * 1000), tz);
}

// The first day after today with anything on it, within NEXT_DAYS, for a day with nothing on.
const NEXT_DAYS = 60;

function nextDay_(tomorrow0, tz) {
  const ahead = events_(tomorrow0, new Date(tomorrow0.getTime() + NEXT_DAYS * 24 * 3600 * 1000), tz);
  if (!ahead.length) return null;
  const first = new Date(Math.max(Math.min.apply(null, ahead.map((e) => e.startMs)), tomorrow0.getTime()));
  const day0 = dayStart_(first, tz);
  const d = Number(Utilities.formatDate(day0, tz, 'd'));
  const th = d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th';
  return {
    label: d + th + Utilities.formatDate(day0, tz, ' MMM yyyy'),
    events: events_(day0, nextDayStart_(day0, tz), tz)
  };
}

function openTasks_(lists, today, tomorrow) {
  const out = [];
  lists.forEach((list) => {
    taskItems_(list.id, { showCompleted: false }).forEach((t) => {
      if (!t.title) return;
      const due = t.due ? t.due.slice(0, 10) : '';
      out.push({ id: t.id, list: list.id, title: t.title, dueDay: due, due: dueLabel_(due, today, tomorrow) });
    });
  });
  // Overdue and today first, then by date, undated last.
  out.sort((a, b) => (a.dueDay || '9999') < (b.dueDay || '9999') ? -1 : (a.dueDay || '9999') > (b.dueDay || '9999') ? 1 : 0);
  return out;
}

function doneTasks_(lists, today0) {
  const out = [];
  lists.forEach((list) => {
    taskItems_(list.id, { showCompleted: true, showHidden: true, completedMin: today0.toISOString() })
      .forEach((t) => { if (t.status === 'completed' && t.title) out.push({ title: t.title }); });
  });
  return out;
}

function markDone_(list, task) {
  if (!list || !task) return { ok: false, error: 'task' };
  Tasks.Tasks.patch({ status: 'completed' }, list, task);
  return { ok: true };
}

// Every task in a list matching the query, a page of 100 at a time.
function taskItems_(listId, query) {
  const out = [];
  let pageToken;
  do {
    const res = Tasks.Tasks.list(listId, Object.assign({ maxResults: 100, pageToken: pageToken }, query));
    (res.items || []).forEach((t) => out.push(t));
    pageToken = res.nextPageToken;
  } while (pageToken);
  return out;
}

function lists_() {
  const out = [];
  let pageToken;
  do {
    const res = Tasks.Tasklists.list({ maxResults: 100, pageToken: pageToken });
    (res.items || []).forEach((l) => out.push(l));
    pageToken = res.nextPageToken;
  } while (pageToken);
  return out;
}

function dueLabel_(due, today, tomorrow) {
  if (!due) return '';
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  if (due === tomorrow) return 'tomorrow';
  // Due dates are whole days, stored as midnight UTC.
  return Utilities.formatDate(new Date(due + 'T12:00:00Z'), 'UTC', 'EEE d MMM');
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
